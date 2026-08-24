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
from antaerus_brain.mission.recovery import RecoveryManager
from antaerus_brain.mission.reflexion import ReflexionEngine
from antaerus_brain.mission.schemas import Mission, MissionStep
from antaerus_brain.mission.state import MissionStateStore
from antaerus_brain.tools.base import BaseTool


class _Echo(BaseModel):
    text: str = "x"


class _ToolA(BaseTool):
    name = "toolA"
    description = "a"
    risk_level = "low"
    category = "knowledge"
    autonomy_level = 1
    input_model = _Echo

    async def _run(self, payload: _Echo) -> dict[str, Any]:
        return {"got": payload.text}


def _fake_settings() -> Any:
    return type("S", (), {"assistant_name": "aNtaerus"})()


class _FakeLLM:
    provider_name = "ollama"

    def __init__(self, responses: list[str] | None = None) -> None:
        self._responses = list(responses or [])
        self.calls: list[GenerationRequest] = []

    async def complete(self, request: GenerationRequest) -> CompletionResult:
        self.calls.append(request)
        if not self._responses:
            raise RuntimeError("no responses")
        return CompletionResult(
            provider="ollama", model="fake", text=self._responses.pop(0), finish_reason="stop",
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]:
        r = await self.complete(request)
        yield StreamingEvent(event="token", data={"text": r.text})
        yield StreamingEvent(event="complete", data={"text": r.text, "provider": "ollama", "model": "fake"})


@pytest.mark.asyncio
async def test_recovery_skips_replay_if_snapshot_exists(tmp_path: Path):
    state = MissionStateStore(tmp_path / "m.db")
    await state.initialize()
    settings = _fake_settings()
    _ToolA(settings)  # type: ignore[arg-type]
    mission = Mission(
        id="m", title="R", user_request="u", status="running",
        steps=[
            MissionStep(id="s0", index=0, title="s0", status="completed", tool_name="toolA",
                        tool_args={"text": "a"}),
            MissionStep(id="s1", index=1, title="s1", status="pending", tool_name="toolA",
                        tool_args={"text": "b"}, depends_on=[0]),
        ],
    )
    await state.create_mission(mission)
    await state.mark_step_started("m", "s1")
    interrupted = await state.find_interrupted_steps("m")
    assert len(interrupted) == 1

    from antaerus_brain.mission.schemas import StepResult
    from antaerus_brain.mission.state import _payload_hash

    snapshot = StepResult(
        step_id="s1", ok=True, status="completed", output="from snapshot",
        tool_name="toolA", tool_args={"text": "b"},
    ).model_dump(mode="json")
    await state.record_idempotency(
        "m", "s1", _payload_hash("toolA", {"text": "b"}), snapshot,
    )

    recovered = await RecoveryManager(state).recover("m")
    assert recovered.status == "paused"
    loaded = await state.get_mission("m")
    assert loaded.steps[1].status == "completed"
    assert loaded.steps[1].result is not None
    assert loaded.steps[1].result.output == "from snapshot"


@pytest.mark.asyncio
async def test_reflexion_llm_retries_then_fallbacks_heuristic(tmp_path: Path):
    llm = _FakeLLM(responses=["not_json", "encore_non_json"])
    mission = Mission(id="m", title="T", user_request="u", status="failed", steps=[])
    report = await ReflexionEngine(llm_client=llm).run(mission)
    assert report.score_quality == 0.0 or report.score_quality == 1.0
    assert report.mission_id == "m"
