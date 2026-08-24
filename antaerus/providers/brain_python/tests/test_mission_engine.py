from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from antaerus_brain.llm import (
    CompletionResult,
    GenerationRequest,
    StreamingEvent,
)
from antaerus_brain.mission.engine import MissionPlanner
from antaerus_brain.mission.schemas import Mission, MissionStep
from antaerus_brain.mission.semantic_verifier import SemanticVerifier
from antaerus_brain.mission.verifier import StructuralVerifier


class FakeLLMClient:
    provider_name = "ollama"

    def __init__(self, responses: list[str] | None = None, *, error: Exception | None = None) -> None:
        self._responses = list(responses or [])
        self._calls: list[GenerationRequest] = []
        self._error = error

    @property
    def calls(self) -> list[GenerationRequest]:
        return list(self._calls)

    async def complete(self, request: GenerationRequest) -> CompletionResult:
        self._calls.append(request)
        if self._error is not None:
            raise self._error
        if not self._responses:
            raise RuntimeError("no fake response configured")
        text = self._responses.pop(0)
        return CompletionResult(
            provider="ollama",
            model="fake",
            text=text,
            finish_reason="stop",
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]:
        result = await self.complete(request)
        yield StreamingEvent(event="token", data={"text": result.text})
        yield StreamingEvent(
            event="complete",
            data={"text": result.text, "provider": "ollama", "model": "fake"},
        )


@pytest.mark.asyncio
async def test_planner_json_roundtrip_simple():
    llm = FakeLLMClient(
        responses=[
            """
{
  "title": "Rapport meteo",
  "plan": "Recuperer la meteo puis resumer.",
  "steps": [
    {"index": 0, "title": "Meteo Paris", "description": "Lire meteo a Paris", "tool_name": "weather",
     "tool_args": {"city": "Paris"}, "depends_on": [], "expected_output": "Donnees meteorologiques"},
    {"index": 1, "title": "Resumer", "description": "Synthetiser", "tool_name": null, "depends_on": [0]}
  ]
}
"""
        ]
    )
    planner = MissionPlanner(llm_client=llm, provider_name="ollama")
    mission = await planner.plan("Quel temps a Paris?", session_id="s1", autonomy_level=0)
    assert mission.status == "planned"
    assert mission.session_id == "s1"
    assert mission.title == "Rapport meteo"
    assert len(mission.steps) == 2
    assert mission.steps[0].tool_name == "weather"
    assert mission.steps[0].tool_args == {"city": "Paris"}
    assert mission.steps[1].depends_on == [0]
    assert mission.steps[1].tool_name is None
    assert len(llm.calls) == 1


@pytest.mark.asyncio
async def test_planner_retries_on_invalid_json_then_succeeds():
    llm = FakeLLMClient(responses=[
        "Bonjour je voudrais",  # pas du JSON
        '{"bad_structure": true}',  # pas de steps
        """
{
  "title": "Fallback reussite",
  "plan": "Ok alors.",
  "steps": [
    {"index": 0, "title": "Unique", "description": "One step"}
  ]
}
""",
    ])
    planner = MissionPlanner(llm_client=llm)
    mission = await planner.plan("blah")
    assert mission.title == "Fallback reussite"
    assert len(mission.steps) == 1
    assert len(llm.calls) == 3


@pytest.mark.asyncio
async def test_planner_ultimate_fallback_after_all_failed():
    llm = FakeLLMClient(responses=["not json", "nope", "still nope"])
    planner = MissionPlanner(llm_client=llm)
    mission = await planner.plan("toto")
    assert mission.status == "planned"
    assert len(mission.steps) == 1
    assert "Fallback" in mission.plan or "fallback" in mission.plan.lower()


def test_verifier_valid_mission_ok():
    mission = Mission(
        id="m",
        title="T",
        user_request="r",
        status="planned",
        steps=[
            MissionStep(id="s0", index=0, title="S0", tool_name="weather"),
            MissionStep(id="s1", index=1, title="S1", depends_on=[0]),
        ],
    )
    v = StructuralVerifier(allowed_tool_names=["weather"])
    result = v.verify(mission)
    assert result.ok is True
    assert result.errors == []


def test_verifier_missing_tool_in_allowed_list():
    mission = Mission(
        id="m",
        title="T",
        user_request="r",
        status="planned",
        steps=[MissionStep(id="s0", index=0, title="S0", tool_name="unknown_tool")],
    )
    v = StructuralVerifier(allowed_tool_names=["weather"])
    r = v.verify(mission)
    assert r.ok is False
    assert any("unknown_tool" in e for e in r.errors)


def test_verifier_cycle_and_bad_indexes():
    mission = Mission(
        id="m",
        title="T",
        user_request="r",
        status="planned",
        steps=[
            MissionStep(id="s0", index=0, title="S0", depends_on=[1]),
            MissionStep(id="s1", index=1, title="S1", depends_on=[0]),
        ],
    )
    v = StructuralVerifier()
    r = v.verify(mission)
    assert r.ok is False
    cycle_errors = [e for e in r.errors if "cycle" in e.lower() or "ordre" in e.lower() or ">=" in e or "depends_on" in e]
    assert cycle_errors

    mission2 = Mission(
        id="m2", title="T", user_request="r", status="planned",
        steps=[
            MissionStep(id="a", index=0, title="a"),
            MissionStep(id="b", index=2, title="b"),
        ],
    )
    r2 = StructuralVerifier().verify(mission2)
    assert r2.ok is False
    assert any("consecutifs" in e or "double" in e for e in r2.errors)


def test_verifier_draft_tolerates_empty_steps():
    m = Mission(id="m", title="T", user_request="r", status="draft", steps=[])
    assert StructuralVerifier().verify(m).ok is True


def test_verifier_warnings_not_fatal():
    mission = Mission(
        id="m",
        title="T",
        user_request="r",
        status="planned",
        budget_tokens=10,
        used_tokens=11,
        steps=[
            MissionStep(id="s0", index=0, title="S0", tool_args={"a": 1}),
        ],
    )
    r = StructuralVerifier().verify(mission)
    assert r.ok is True
    assert any("budget" in w or "token" in w for w in r.warnings)
    assert any("tool_args sans tool_name" in w for w in r.warnings)


@pytest.mark.asyncio
async def test_semantic_verifier_no_llm_is_noop_ok():
    verifier = SemanticVerifier(llm_client=None)
    m = Mission(id="m", title="T", user_request="r")
    r = await verifier.verify(m)
    assert r.ok is True
    assert any("skipped" in w.lower() for w in r.warnings)


@pytest.mark.asyncio
async def test_semantic_verifier_llm_ok_path():
    llm = FakeLLMClient(responses=['{"ok": true, "errors": [], "warnings": ["info"]}'])
    sv = SemanticVerifier(llm_client=llm)
    m = Mission(
        id="m", title="T", user_request="r",
        steps=[
            MissionStep(id="s0", index=0, title="Fetch X", tool_name="browser", description="fetch"),
            MissionStep(id="s1", index=1, title="Use X", depends_on=[0], description="utilise le contenu"),
        ],
    )
    result = await sv.verify(m, context="rien")
    assert result.ok is True
    assert result.warnings == ["info"]
    assert len(llm.calls) == 1


@pytest.mark.asyncio
async def test_semantic_verifier_handles_llm_exception_gracefully():
    llm = FakeLLMClient(error=RuntimeError("boom"))
    sv = SemanticVerifier(llm_client=llm)
    result = await sv.verify(Mission(id="m", title="T", user_request="r"))
    assert result.ok is True
    assert any("boom" in w or "unreachable" in w.lower() for w in result.warnings)


@pytest.mark.asyncio
async def test_semantic_verifier_retries_on_bad_json_then_reports_ok():
    llm = FakeLLMClient(responses=[
        "markdown seulement",
        '{"ok": true, "errors": [], "warnings": ["apres retry"]}',
    ])
    sv = SemanticVerifier(llm_client=llm)
    result = await sv.verify(Mission(id="m", title="T", user_request="r"))
    assert result.ok is True
    assert "apres retry" in result.warnings
    assert len(llm.calls) == 2
