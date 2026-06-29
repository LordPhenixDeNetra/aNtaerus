from __future__ import annotations

import json
from collections.abc import AsyncIterator

from antaerus_brain.llm import GenerationRequest, LLMClient, StreamingEvent


def format_sse_event(event: StreamingEvent) -> bytes:
    payload = json.dumps(event.data, ensure_ascii=True)
    return f"event: {event.event}\ndata: {payload}\n\n".encode("utf-8")


async def sse_event_stream(
    client: LLMClient,
    request: GenerationRequest,
) -> AsyncIterator[bytes]:
    async for event in client.stream(request):
        yield format_sse_event(event)
