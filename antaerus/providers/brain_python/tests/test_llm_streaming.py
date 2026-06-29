from __future__ import annotations

import asyncio
from typing import Literal, cast

from antaerus_brain.llm import CompletionResult, GenerationRequest, LLMClient, StreamingEvent
from antaerus_brain.llm.streaming import format_sse_event, sse_event_stream


def test_format_sse_event_returns_expected_wire_format() -> None:
    payload = format_sse_event(StreamingEvent(event="token", data={"text": "Bon"})).decode("utf-8")

    assert payload.startswith("event: token")
    assert '"text": "Bon"' in payload


def test_sse_event_stream_yields_all_events() -> None:
    class FakeClient:
        provider_name: Literal["ollama"] = "ollama"

        async def complete(self, request: GenerationRequest) -> CompletionResult:
            return CompletionResult(provider="ollama", model="llama", text="Bonjour")

        async def stream(self, request: GenerationRequest):
            yield StreamingEvent(event="token", data={"text": "Bon"})
            yield StreamingEvent(event="complete", data={"text": "Bonjour"})

    async def collect() -> list[bytes]:
        stream = sse_event_stream(cast(LLMClient, FakeClient()), GenerationRequest(prompt="Hi"))
        return [chunk async for chunk in stream]

    chunks = asyncio.run(collect())

    assert len(chunks) == 2
    assert chunks[0].decode("utf-8").startswith("event: token")
    assert chunks[1].decode("utf-8").startswith("event: complete")
