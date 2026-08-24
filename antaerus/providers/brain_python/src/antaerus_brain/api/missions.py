from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from antaerus_brain.config import get_settings
from antaerus_brain.llm import ProviderName
from antaerus_brain.llm.factory import create_llm_client
from antaerus_brain.mission.engine import MissionPlanner
from antaerus_brain.mission.orchestrator import MissionOrchestrator
from antaerus_brain.mission.recovery import RecoveryManager
from antaerus_brain.mission.reflexion import ReflexionEngine
from antaerus_brain.mission.schemas import Mission, ReflexionReport
from antaerus_brain.mission.semantic_verifier import SemanticVerifier
from antaerus_brain.mission.state import MissionStateStore
from antaerus_brain.mission.verifier import StructuralVerifier
from antaerus_brain.tools import create_tool_registry


router = APIRouter(prefix="/missions", tags=["mission"])


class _CreateMissionRequest(BaseModel):
    sessionId: Optional[str] = Field(default=None, alias="session_id")
    userRequest: str = Field(min_length=1, alias="user_request")
    provider: Optional[ProviderName] = None
    model: Optional[str] = None
    autonomyLevel: int = Field(default=0, alias="autonomy_level", ge=0, le=5)


class _ListMissionsResponse(BaseModel):
    items: list[Mission]
    total: int


class _MissionEventsResponse(BaseModel):
    items: list[dict[str, Any]]


def _state_store() -> MissionStateStore:
    settings = get_settings()
    return MissionStateStore(settings.memory_db_path)


def _create_orchestrator(
    provider: Optional[ProviderName] = None,
    model: Optional[str] = None,
) -> tuple[MissionOrchestrator, MissionPlanner, ReflexionEngine, RecoveryManager]:
    settings = get_settings()
    state = _state_store()
    registry = create_tool_registry(settings)
    tools = registry.list_tools()
    allowed_names = [t.name for t in tools]
    sv = StructuralVerifier(
        allowed_tool_names=allowed_names,
        max_steps=settings.mission_max_steps,
    )
    resolved_provider: ProviderName = provider or settings.default_provider
    try:
        llm_client = create_llm_client(settings, resolved_provider)
    except Exception:  # noqa: BLE001
        llm_client = None
    semantic = SemanticVerifier(
        llm_client=llm_client,
        provider_name=resolved_provider,
        model=model,
        llm_timeout_seconds=settings.mission_llm_timeout_seconds,
    )
    recovery = RecoveryManager(state)
    orchestrator = MissionOrchestrator(
        state=state,
        structural_verifier=sv,
        semantic_verifier=semantic,
        tools=tools,
        recovery=recovery,
        llm_client=llm_client,
    )
    planner = MissionPlanner(
        llm_client=llm_client,
        provider_name=resolved_provider,
        model=model,
        max_steps=settings.mission_max_steps,
    )
    reflexion = ReflexionEngine(
        llm_client=llm_client,
        provider_name=resolved_provider,
        model=model,
    )
    return orchestrator, planner, reflexion, recovery


@router.post("", response_model=Mission, status_code=201)
async def create_mission(req: _CreateMissionRequest) -> Mission:
    settings = get_settings()
    state = _state_store()
    await state.initialize()
    _, planner, _, _ = _create_orchestrator(req.provider, req.model)
    registry = create_tool_registry(settings)
    available = registry.describe_tools()
    mission = await planner.plan(
        user_request=req.userRequest,
        session_id=req.sessionId,
        available_tools=available,
        autonomy_level=req.autonomyLevel,
    )
    return await state.create_mission(mission)


@router.get("", response_model=_ListMissionsResponse)
async def list_missions(
    sessionId: Optional[str] = Query(default=None),  # noqa: N803
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
) -> _ListMissionsResponse:
    state = _state_store()
    await state.initialize()
    items = await state.list_missions(session_id=sessionId, status=status, limit=limit)
    return _ListMissionsResponse(items=items, total=len(items))


@router.get("/{mission_id}", response_model=Mission)
async def get_mission(mission_id: str) -> Mission:
    state = _state_store()
    await state.initialize()
    try:
        return await state.get_mission(mission_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{mission_id}/run", response_model=Mission)
async def run_mission(
    mission_id: str, provider: Optional[ProviderName] = None, model: Optional[str] = None
) -> Mission:
    state = _state_store()
    await state.initialize()
    try:
        existing = await state.get_mission(mission_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if existing.status not in ("planned", "paused"):
        raise HTTPException(
            status_code=409,
            detail=f"Mission status={existing.status} cannot be run (expected planned/paused)",
        )
    orchestrator, _, _, _ = _create_orchestrator(provider, model)
    try:
        return await orchestrator.run(mission_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{mission_id}/recover", response_model=Mission)
async def recover_mission(mission_id: str) -> Mission:
    state = _state_store()
    await state.initialize()
    try:
        await state.get_mission(mission_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    _, _, _, recovery = _create_orchestrator()
    try:
        return await recovery.recover(mission_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{mission_id}/reflect", response_model=ReflexionReport)
async def reflect_mission(
    mission_id: str, provider: Optional[ProviderName] = None, model: Optional[str] = None
) -> ReflexionReport:
    state = _state_store()
    await state.initialize()
    try:
        mission = await state.get_mission(mission_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if mission.status not in ("completed", "failed", "cancelled"):
        raise HTTPException(
            status_code=409,
            detail=f"Mission status={mission.status} not ready for reflection",
        )
    _, _, reflexion, _ = _create_orchestrator(provider, model)
    report = await reflexion.run(mission)
    await state.append_event(
        mission_id,
        "reflexion",
        report.model_dump(mode="json"),
    )
    if report.facts_to_remember:
        try:
            from antaerus_brain.memory.kernel import MemoryKernel

            kernel = MemoryKernel(get_settings().memory_db_path)
            await kernel.initialize()
            for fact in report.facts_to_remember:
                await kernel.insert_event(
                    content=f"[mission:{mission_id}] reflexion fact: {fact}",
                    session_id=mission.session_id,
                )
        except Exception:  # noqa: BLE001
            pass
    return report


@router.get("/{mission_id}/events", response_model=_MissionEventsResponse)
async def get_mission_events(mission_id: str) -> _MissionEventsResponse:
    state = _state_store()
    await state.initialize()
    try:
        await state.get_mission(mission_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    items = await state.list_events(mission_id)
    return _MissionEventsResponse(items=items)
