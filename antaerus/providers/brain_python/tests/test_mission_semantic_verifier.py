from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from antaerus_brain.llm import CompletionResult, GenerationRequest, StreamingEvent
from antaerus_brain.mission.schemas import Mission, MissionStep
from antaerus_brain.mission.semantic_verifier import SemanticVerifier


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
            raise RuntimeError("no fake response")
        return CompletionResult(
            provider="ollama", model="fake",
            text=self._responses.pop(0), finish_reason="stop",
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]:  # pragma: no cover
        r = await self.complete(request)
        yield StreamingEvent(event="token", data={"text": r.text})
        yield StreamingEvent(event="complete", data={"text": r.text, "provider": "ollama", "model": "fake"})


@pytest.mark.asyncio
async def test_semantic_fatal_ko_blocks_mission():
    llm = _FakeLLM(responses=[
        "{\"ok\": false, \"errors\": [\"Etape 2 utilise le fichier cree a l'etape 5.\"], \"warnings\": []}",
    ])
    sv = SemanticVerifier(llm_client=llm)
    mission = Mission(
        id="m",
        title="M",
        user_request="Creer fichier puis le lire hors sequence",
        steps=[
            MissionStep(id="s0", index=0, title="Creer fichier", tool_name="filesystem"),
            MissionStep(id="s1", index=1, title="Lire fichier X", description="lire X",
                        tool_name="filesystem", depends_on=[2]),
            MissionStep(id="s2", index=2, title="Creer X", tool_name="filesystem"),
        ],
    )
    result = await sv.verify(mission)
    assert result.ok is False
    assert any("Etape 2" in e for e in result.errors)


@pytest.mark.asyncio
async def test_semantic_prompt_mentions_context_and_steps():
    llm = _FakeLLM(responses=['{"ok": true, "errors": [], "warnings": []}'])
    sv = SemanticVerifier(llm_client=llm)
    await sv.verify(
        Mission(
            id="m", title="T", user_request="demand",
            steps=[
                MissionStep(id="s0", index=0, title="Fetch", description="fetch site",
                            tool_name="browser", depends_on=[]),
                MissionStep(id="s1", index=1, title="Analyse", depends_on=[0]),
            ],
        ),
        context="Contexte important: token X expirera demain.",
    )
    assert len(llm.calls) == 1
    user_msg_content = next(m.content for m in reversed(llm.calls[0].messages) if m.role == "user")
    assert "Contexte important" in user_msg_content
    assert "idx=0" in user_msg_content
    assert "idx=1" in user_msg_content
