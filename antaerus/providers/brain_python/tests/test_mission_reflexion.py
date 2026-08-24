from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from antaerus_brain.llm import (
    CompletionResult,
    GenerationRequest,
    StreamingEvent,
)
from antaerus_brain.mission.reflexion import ReflexionEngine
from antaerus_brain.mission.schemas import Mission, MissionStep, StepResult


class _FakeLLM:
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
            raise RuntimeError("no fake")
        return CompletionResult(
            provider="ollama", model="fake",
            text=self._responses.pop(0), finish_reason="stop",
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]:
        r = await self.complete(request)
        yield StreamingEvent(event="token", data={"text": r.text})
        yield StreamingEvent(event="complete", data={"text": r.text, "provider": "ollama", "model": "fake"})


@pytest.mark.asyncio
async def test_reflexion_llm_mentions_steps_in_prompt():
    llm = _FakeLLM(responses=[
        '{"summary":"S","successes":[],"failures":[],"suggested_fixes":[],"facts_to_remember":[],"score_quality":0.5}'
    ])
    mission = Mission(
        id="m", title="T", user_request="R", status="completed",
        steps=[
            MissionStep(
                id="s0", index=0, title="S0", tool_name="noop", status="completed",
                result=StepResult(step_id="s0", ok=True, status="completed", output="toto"),
            )
        ],
    )
    report = await ReflexionEngine(llm_client=llm).run(mission)
    assert report.score_quality == 0.5
    assert len(llm.calls) == 1
    user_prompt = next(m.content for m in reversed(llm.calls[0].messages) if m.role == "user")
    assert "idx=0" in user_prompt
    assert "tool=noop" in user_prompt


@pytest.mark.asyncio
async def test_reflexion_fallback_to_heuristic_when_llm_unreachable():
    llm = _FakeLLM(error=ConnectionError("boom"))
    mission = Mission(id="m", title="T", user_request="u", status="failed", steps=[
        MissionStep(id="s0", index=0, title="S0", status="completed"),
    ])
    report = await ReflexionEngine(llm_client=llm).run(mission)
    assert report.score_quality > 0.0
    assert len(report.successes) == 1
