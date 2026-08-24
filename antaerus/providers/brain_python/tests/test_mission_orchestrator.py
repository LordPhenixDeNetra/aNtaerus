from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import pytest
from pydantic import BaseModel

from antaerus_brain.llm import (
    CompletionResult,
    GenerationRequest,
    StreamingEvent,
)
from antaerus_brain.mission.orchestrator import MissionOrchestrator
from antaerus_brain.mission.recovery import RecoveryManager
from antaerus_brain.mission.reflexion import ReflexionEngine
from antaerus_brain.mission.schemas import Mission, MissionStep, StepResult
from antaerus_brain.mission.semantic_verifier import SemanticVerifier
from antaerus_brain.mission.state import MissionStateStore
from antaerus_brain.mission.verifier import StructuralVerifier
from antaerus_brain.tools.base import (
    BaseTool,
    ToolResult,
)


class _FakeLLMClient:
    provider_name = "ollama"

    def __init__(self, responses: list[str] | None = None, error: Exception | None = None) -> None:
        self._responses = list(responses or [])
        self._error = error
        self.calls: list[GenerationRequest] = []

    async def complete(self, request: GenerationRequest) -> CompletionResult:
        self.calls.append(request)
        if self._error is not None:
            raise self._error
        if not self._responses:
            raise RuntimeError("no fake response")
        return CompletionResult(
            provider="ollama", model="fake",
            text=self._responses.pop(0), finish_reason="stop",
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]:
        r = await self.complete(request)
        yield StreamingEvent(event="token", data={"text": r.text})
        yield StreamingEvent(event="complete", data={"text": r.text, "provider": "ollama", "model": "fake"})


class _EchoInput(BaseModel):
    text: str = "echo"


class _FailInput(BaseModel):
    reason: str = "boom"


class _NoopTool(BaseTool):
    name = "noop"
    description = "outil fictif qui renvoie ok"
    risk_level = "low"
    category = "knowledge"
    autonomy_level = 1
    input_model = _EchoInput
    operations = ("echo",)

    async def _run(self, payload: _EchoInput) -> dict[str, Any]:
        return {"echo": payload.text}


class _FailTool(BaseTool):
    name = "failtool"
    description = "outil fictif qui echoue toujours"
    risk_level = "medium"
    category = "knowledge"
    autonomy_level = 1
    input_model = _FailInput

    async def _run(self, payload: _FailInput) -> ToolResult:
        return self.error_result(payload.reason)


class _CrashTool(BaseTool):
    name = "crashtool"
    description = "leve une exception systematique"
    risk_level = "high"
    category = "knowledge"
    autonomy_level = 2
    input_model = _EchoInput

    async def _run(self, payload: _EchoInput) -> ToolResult:
        raise RuntimeError("kapow")


def _make_settings(settings_obj: object) -> None:
    return None


def _stub_tools() -> tuple[BaseTool, BaseTool, BaseTool]:
    class _Cfg:
        pass

    fake_settings: Any = type("S", (), {"assistant_name": "aNtaerus"})()
    noop = _NoopTool(fake_settings)  # type: ignore[arg-type]
    fail = _FailTool(fake_settings)  # type: ignore[arg-type]
    crash = _CrashTool(fake_settings)  # type: ignore[arg-type]
    return noop, fail, crash


@pytest.mark.asyncio
async def test_orchestrator_runs_simple_mission_with_tools(tmp_path: Path):
    state = MissionStateStore(tmp_path / "m.db")
    await state.initialize()
    noop, fail, crash = _stub_tools()
    tools = [noop, fail, crash]
    allowed = [t.name for t in tools]
    orchestrator = MissionOrchestrator(
        state=state,
        structural_verifier=StructuralVerifier(allowed_tool_names=allowed),
        semantic_verifier=SemanticVerifier(llm_client=None),
        tools=tools,
        recovery=RecoveryManager(state),
    )
    mission = Mission(
        id="m1",
        title="Simple",
        user_request="deux etapes",
        status="planned",
        steps=[
            MissionStep(
                id="s0", index=0, title="Step0", description="echo step",
                tool_name="noop", tool_args={"text": "bonjour"},
            ),
            MissionStep(
                id="s1", index=1, title="Step1", description="no tool step",
                depends_on=[0],
                expected_output="reflexion sur resultat precedent",
            ),
        ],
    )
    await state.create_mission(mission)
    final = await orchestrator.run("m1")
    assert final.status == "completed"
    loaded = await state.get_mission("m1")
    assert loaded.steps[0].status == "completed"
    assert loaded.steps[0].result is not None
    assert loaded.steps[0].result.ok is True
    assert loaded.steps[0].tool_args == {"text": "bonjour"}
    assert loaded.steps[1].status == "skipped" or loaded.steps[1].status == "completed"
    assert loaded.completed_at is not None


@pytest.mark.asyncio
async def test_orchestrator_stops_on_tool_ko_and_sets_failed(tmp_path: Path):
    state = MissionStateStore(tmp_path / "m.db")
    await state.initialize()
    noop, fail, crash = _stub_tools()
    tools = [noop, fail, crash]
    orchestrator = MissionOrchestrator(
        state=state,
        structural_verifier=StructuralVerifier(allowed_tool_names=[t.name for t in tools]),
        semantic_verifier=SemanticVerifier(llm_client=None),
        tools=tools,
        recovery=RecoveryManager(state),
    )
    mission = Mission(
        id="m2", title="Echec", user_request="doit echouer", status="planned",
        steps=[
            MissionStep(id="s0", index=0, title="OK", tool_name="noop", tool_args={"text": "x"}),
            MissionStep(id="s1", index=1, title="FAIL", depends_on=[0], tool_name="failtool", tool_args={"reason": "erreur voulue"}),
            MissionStep(id="s2", index=2, title="Jamais joue", depends_on=[1], tool_name="noop", tool_args={"text": "never"}),
        ],
    )
    await state.create_mission(mission)
    final = await orchestrator.run("m2")
    assert final.status == "failed"
    loaded = await state.get_mission("m2")
    assert loaded.steps[0].status == "completed"
    assert loaded.steps[1].status == "failed"
    assert loaded.steps[2].status == "pending"
    events = await state.list_events("m2")
    kinds = [e["kind"] for e in events]
    assert "step_finished" in kinds
    assert any("step_exception" in k or "step_" in k for k in kinds)


@pytest.mark.asyncio
async def test_orchestrator_raises_if_status_bad(tmp_path: Path):
    state = MissionStateStore(tmp_path / "m.db")
    await state.initialize()
    tools: list[BaseTool] = []
    orch = MissionOrchestrator(
        state=state,
        structural_verifier=StructuralVerifier(),
        semantic_verifier=SemanticVerifier(llm_client=None),
        tools=tools,
        recovery=RecoveryManager(state),
    )
    mission = Mission(id="m", title="T", user_request="R", status="completed", steps=[])
    await state.create_mission(mission)
    with pytest.raises(ValueError, match="status=completed"):
        await orch.run("m")


@pytest.mark.asyncio
async def test_recovery_scan_detects_running_step(tmp_path: Path):
    state = MissionStateStore(tmp_path / "m.db")
    await state.initialize()
    mission = Mission(
        id="mr", title="R", user_request="u", status="running",
        steps=[
            MissionStep(id="s0", index=0, title="ok", status="completed"),
            MissionStep(id="s1", index=1, title="interrompu", status="pending"),
        ],
    )
    await state.create_mission(mission)
    await state.mark_step_started("mr", "s1")
    recovery = RecoveryManager(state)
    scan = await recovery.scan()
    assert any(mid == "mr" for mid, _ in scan)

    recovered = await recovery.recover("mr")
    assert recovered.status == "paused"
    events = await state.list_events("mr")
    assert any(e["kind"] == "recovered" for e in events)


@pytest.mark.asyncio
async def test_orchestrator_uses_idempotency_snapshot_no_second_execution(tmp_path: Path, monkeypatch):
    state = MissionStateStore(tmp_path / "m.db")
    await state.initialize()
    noop, fail, crash = _stub_tools()
    call_counter = {"n": 0}
    original_execute = noop.execute

    async def counted_execute(args):
        call_counter["n"] += 1
        return await original_execute(args)

    monkeypatch.setattr(noop, "execute", counted_execute)
    tools = [noop]
    orch = MissionOrchestrator(
        state=state,
        structural_verifier=StructuralVerifier(allowed_tool_names=["noop"]),
        semantic_verifier=SemanticVerifier(llm_client=None),
        tools=tools,
        recovery=RecoveryManager(state),
    )
    mission = Mission(
        id="m", title="idem", user_request="r", status="planned",
        steps=[
            MissionStep(id="s0", index=0, title="n1", tool_name="noop", tool_args={"text": "once"}),
            MissionStep(id="s1", index=1, title="n2", tool_name="noop", tool_args={"text": "once"}),
        ],
    )
    await state.create_mission(mission)
    final = await orch.run("m")
    assert final.status == "completed"
    assert call_counter["n"] == 1  # la deuxieme a les memes args -> snapshot rejoue
    loaded = await state.get_mission("m")
    assert loaded.steps[1].result is not None
    assert loaded.steps[1].result.ok is True


@pytest.mark.asyncio
async def test_reflexion_heuristic_no_llm(tmp_path: Path):
    mission = Mission(
        id="m", title="R", user_request="u", status="completed",
        steps=[
            MissionStep(id="s0", index=0, title="S0", status="completed",
                        result=StepResult(step_id="s0", ok=True, status="completed", output="ok")),
            MissionStep(id="s1", index=1, title="S1", status="failed", error="nope"),
        ],
    )
    report = await ReflexionEngine(llm_client=None).run(mission)
    assert report.mission_id == "m"
    assert any("idx=0" in s for s in report.successes)
    assert any("idx=1" in f for f in report.failures)
    assert 0.0 <= report.score_quality <= 1.0
    assert len(report.facts_to_remember) == 0
    assert len(report.suggested_fixes) >= 1


@pytest.mark.asyncio
async def test_reflexion_llm_json_roundtrip(tmp_path: Path):
    llm = _FakeLLMClient(responses=[
        """
{
  "summary": "Mission terminee, 2 etapes 1 echec",
  "successes": ["idx=0 noop ok"],
  "failures": ["idx=1 failtool erreur voulue"],
  "suggested_fixes": ["Verifier les credentials"],
  "facts_to_remember": ["Utilisateur prefere les rapports courts", "Aime les echecs bien documentes", "Trop de dependances externes"],
  "score_quality": 0.6
}
"""
    ])
    mission = Mission(
        id="m-llm", title="R", user_request="u", status="failed",
        steps=[
            MissionStep(id="s0", index=0, title="S0", status="completed",
                        result=StepResult(step_id="s0", ok=True, status="completed", output="ok")),
            MissionStep(id="s1", index=1, title="S1", status="failed", error="erreur voulue"),
        ],
    )
    report = await ReflexionEngine(llm_client=llm).run(mission)
    assert report.summary == "Mission terminee, 2 etapes 1 echec"
    assert len(report.facts_to_remember) == 3
    assert report.score_quality == 0.6
    assert len(llm.calls) == 1
