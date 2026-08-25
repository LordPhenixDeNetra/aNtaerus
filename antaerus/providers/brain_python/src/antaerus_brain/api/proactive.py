from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from antaerus_brain.config import get_settings
from antaerus_brain.proactive.collectors import (
    CollectorRegistry,
    create_collector_registry,
)
from antaerus_brain.proactive.command_center import (
    Initiative,
    InitiativeStatus,
    InitiativeStore,
    create_initiative_store,
)
from antaerus_brain.proactive.curator import (
    CuratorPatch,
    CuratorPatchStatus,
    CuratorReport,
    NocturnalCurator,
    create_curator,
)

router = APIRouter(prefix="/proactive", tags=["proactive"])


# Singletons cached per process via get_settings
_registry: CollectorRegistry | None = None
_init_store: InitiativeStore | None = None
_curator: NocturnalCurator | None = None
_custom_collector_configs: list[dict[str, Any]] | None = None


def _registry_singleton() -> CollectorRegistry:
    global _registry, _custom_collector_configs
    if _registry is None:
        _registry = create_collector_registry(get_settings(), _custom_collector_configs or [])
    return _registry


def _store_singleton() -> InitiativeStore:
    global _init_store
    if _init_store is None:
        _init_store = create_initiative_store(get_settings().memory_db_path)
    return _init_store


def _curator_singleton() -> NocturnalCurator:
    global _curator
    if _curator is None:
        _curator = create_curator(get_settings())
    return _curator


class _CollectorInfo(BaseModel):
    name: str
    description: str
    enabled: bool


class _ListCollectorsResponse(BaseModel):
    items: list[_CollectorInfo]


class _RunCollectorResponse(BaseModel):
    collectorName: str
    success: bool
    briefing: dict[str, Any] | None = None
    alerts: list[dict[str, Any]] = Field(default_factory=list)
    error: str | None = None
    ranAt: str


class _RunAllCollectorsResponse(BaseModel):
    items: list[_RunCollectorResponse]


class _CreateInitiativeRequest(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    status: InitiativeStatus = "draft"
    autonomyLevel: int = Field(default=0, alias="autonomy_level", ge=0, le=5)
    budgetTokens: int = Field(default=0, alias="budget_tokens", ge=0)
    triggerType: str = Field(default="manual", alias="trigger_type")
    triggerConfig: dict[str, Any] = Field(default_factory=dict, alias="trigger_config")
    sourceCollector: str | None = Field(default=None, alias="source_collector")
    alertPayload: dict[str, Any] | None = Field(default=None, alias="alert_payload")
    sessionId: str | None = Field(default=None, alias="session_id")


class _PatchInitiativeRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    status: InitiativeStatus | None = None
    autonomyLevel: int | None = Field(default=None, alias="autonomy_level", ge=0, le=5)
    budgetTokens: int | None = Field(default=None, alias="budget_tokens", ge=0)
    budgetTokensUsed: int | None = Field(default=None, alias="budget_tokens_used", ge=0)
    triggerType: str | None = Field(default=None, alias="trigger_type")
    triggerConfig: dict[str, Any] | None = Field(default=None, alias="trigger_config")
    sourceCollector: str | None = Field(default=None, alias="source_collector")
    alertPayload: dict[str, Any] | None = Field(default=None, alias="alert_payload")
    sessionId: str | None = Field(default=None, alias="session_id")
    missionId: str | None = Field(default=None, alias="mission_id")
    error: str | None = None
    ranAt: str | None = Field(default=None, alias="ran_at")
    completedAt: str | None = Field(default=None, alias="completed_at")


class _ListInitiativesResponse(BaseModel):
    items: list[Initiative]
    total: int


class _DecidePatchRequest(BaseModel):
    approve: bool
    by: str | None = None


class _ListPatchesResponse(BaseModel):
    items: list[CuratorPatch]
    total: int


class _SchedulerStatusResponse(BaseModel):
    enabled: bool
    cronHour: int
    lastRun: str | None = None
    nextRun: str | None = None


_scheduler_state: dict[str, Any] = {"enabled": True, "last_run": None}


@router.get("/collectors", response_model=_ListCollectorsResponse)
def list_collectors() -> _ListCollectorsResponse:
    registry = _registry_singleton()
    items: list[_CollectorInfo] = []
    for name in registry.list_names():
        collector = registry.get(name)
        if collector is None:
            continue
        items.append(_CollectorInfo(
            name=name,
            description=getattr(collector, "description", ""),
            enabled=bool(getattr(collector, "enabled", True)),
        ))
    return _ListCollectorsResponse(items=items)


@router.post("/collectors/{collector_name}/run", response_model=_RunCollectorResponse)
async def run_collector(collector_name: str) -> _RunCollectorResponse:
    registry = _registry_singleton()
    result = await registry.run(collector_name)
    if result.error and (
        result.error.startswith("collector '")
        and result.error.endswith(" not found")
    ):
        raise HTTPException(status_code=404, detail=result.error)
    return _RunCollectorResponse(
        collectorName=result.collectorName,
        success=result.success,
        briefing=result.briefing.model_dump() if result.briefing else None,
        alerts=[a.model_dump() for a in result.alerts],
        error=result.error,
        ranAt=result.ranAt,
    )


@router.post("/collectors/run-all", response_model=_RunAllCollectorsResponse)
async def run_all_collectors() -> _RunAllCollectorsResponse:
    registry = _registry_singleton()
    results = await registry.run_all()
    items = [
        _RunCollectorResponse(
            collectorName=r.collectorName,
            success=r.success,
            briefing=r.briefing.model_dump() if r.briefing else None,
            alerts=[a.model_dump() for a in r.alerts],
            error=r.error,
            ranAt=r.ranAt,
        )
        for r in results
    ]
    return _RunAllCollectorsResponse(items=items)


@router.get("/initiatives", response_model=_ListInitiativesResponse)
def list_initiatives(
    status: Optional[str] = Query(default=None),
    sessionId: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> _ListInitiativesResponse:
    store = _store_singleton()
    items = store.list(status=status, session_id=sessionId, limit=limit, offset=offset)
    total = store.count(status=status, session_id=sessionId)
    return _ListInitiativesResponse(items=items, total=total)


@router.post("/initiatives", response_model=Initiative, status_code=201)
def create_initiative(req: _CreateInitiativeRequest) -> Initiative:
    store = _store_singleton()
    return store.create(
        title=req.title,
        description=req.description,
        status=req.status,
        autonomy_level=int(req.autonomyLevel),
        budget_tokens=int(req.budgetTokens),
        trigger_type=req.triggerType,
        trigger_config=req.triggerConfig,
        source_collector=req.sourceCollector,
        alert_payload=req.alertPayload,
        session_id=req.sessionId,
    )


@router.get("/initiatives/{initiative_id}", response_model=Initiative)
def get_initiative(initiative_id: str) -> Initiative:
    store = _store_singleton()
    row = store.get(initiative_id)
    if row is None:
        raise HTTPException(status_code=404, detail="initiative not found")
    return row


@router.patch("/initiatives/{initiative_id}", response_model=Initiative)
def patch_initiative(initiative_id: str, req: _PatchInitiativeRequest) -> Initiative:
    store = _store_singleton()
    fields: dict[str, Any] = {}
    if req.title is not None:
        fields["title"] = req.title
    if req.description is not None:
        fields["description"] = req.description
    if req.status is not None:
        fields["status"] = req.status
    if req.autonomyLevel is not None:
        fields["autonomy_level"] = int(req.autonomyLevel)
    if req.budgetTokens is not None:
        fields["budget_tokens"] = int(req.budgetTokens)
    if req.budgetTokensUsed is not None:
        fields["budget_tokens_used"] = int(req.budgetTokensUsed)
    if req.triggerType is not None:
        fields["trigger_type"] = req.triggerType
    if req.triggerConfig is not None:
        fields["trigger_config"] = req.triggerConfig
    if req.sourceCollector is not None:
        fields["source_collector"] = req.sourceCollector
    if req.alertPayload is not None:
        fields["alert_payload"] = req.alertPayload
    if req.sessionId is not None:
        fields["session_id"] = req.sessionId
    if req.missionId is not None:
        fields["mission_id"] = req.missionId
    if req.error is not None:
        fields["error"] = req.error
    if req.ranAt is not None:
        fields["ran_at"] = req.ranAt
    if req.completedAt is not None:
        fields["completed_at"] = req.completedAt
    row = store.patch(initiative_id, **fields)
    if row is None:
        raise HTTPException(status_code=404, detail="initiative not found")
    return row


@router.post("/initiatives/{initiative_id}/run", response_model=Initiative)
async def run_initiative(initiative_id: str) -> Initiative:
    store = _store_singleton()
    existing = store.get(initiative_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="initiative not found")
    now = None
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    updated = store.patch(
        initiative_id,
        status="running",
        ran_at=now,
        error=None,
    )

    class _Done:
        pass

    return updated or existing


@router.get("/curator/report", response_model=CuratorReport)
def curator_latest_report() -> CuratorReport:
    curator = _curator_singleton()
    latest = curator.latest_report()
    if latest is None:
        raise HTTPException(status_code=404, detail="aucun rapport curator disponible")
    return latest


@router.post("/curator/run", response_model=CuratorReport)
async def curator_run() -> CuratorReport:
    curator = _curator_singleton()
    try:
        report = await curator.run()
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return report


@router.get("/curator/patches", response_model=_ListPatchesResponse)
def list_curator_patches(
    reportId: Optional[str] = Query(default=None),
    status: Optional[CuratorPatchStatus] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> _ListPatchesResponse:
    curator = _curator_singleton()
    items = curator.list_patches(report_id=reportId, status=status, limit=limit)
    return _ListPatchesResponse(items=items, total=len(items))


@router.post("/curator/patches/{patch_id}/approve", response_model=CuratorPatch)
def approve_patch(patch_id: str, req: _DecidePatchRequest) -> CuratorPatch:
    curator = _curator_singleton()
    updated = curator.decide_patch(patch_id, approve=True, by=req.by)
    if updated is None:
        raise HTTPException(status_code=404, detail="patch not found")
    return updated


@router.post("/curator/patches/{patch_id}/reject", response_model=CuratorPatch)
def reject_patch(patch_id: str, req: _DecidePatchRequest) -> CuratorPatch:
    curator = _curator_singleton()
    updated = curator.decide_patch(patch_id, approve=False, by=req.by)
    if updated is None:
        raise HTTPException(status_code=404, detail="patch not found")
    return updated


@router.get("/scheduler/status", response_model=_SchedulerStatusResponse)
def scheduler_status() -> _SchedulerStatusResponse:
    settings = get_settings()
    cron_hour = int(getattr(settings, "curator_cron_hour", 2))
    return _SchedulerStatusResponse(
        enabled=bool(_scheduler_state.get("enabled", True)),
        cronHour=cron_hour,
        lastRun=_scheduler_state.get("last_run"),
        nextRun=None,
    )


@router.post("/scheduler/start", response_model=_SchedulerStatusResponse)
def scheduler_start() -> _SchedulerStatusResponse:
    _scheduler_state["enabled"] = True
    return scheduler_status()


@router.post("/scheduler/stop", response_model=_SchedulerStatusResponse)
def scheduler_stop() -> _SchedulerStatusResponse:
    _scheduler_state["enabled"] = False
    return scheduler_status()
