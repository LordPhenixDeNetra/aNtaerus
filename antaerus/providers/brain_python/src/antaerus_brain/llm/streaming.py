from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import cast

from antaerus_brain.llm import GenerationRequest, LLMClient, StreamingEvent


def format_sse_event(event: StreamingEvent) -> bytes:
    payload = json.dumps(event.data, ensure_ascii=True)
    return f"event: {event.event}\ndata: {payload}\n\n".encode("utf-8")


async def sse_event_stream(
    client_or_stream: LLMClient | AsyncIterator[StreamingEvent],
    request: GenerationRequest | None = None,
) -> AsyncIterator[bytes]:
    if request is None:
        stream = cast(AsyncIterator[StreamingEvent], client_or_stream)
    else:
        stream = cast(LLMClient, client_or_stream).stream(request)

    async for event in stream:
        yield format_sse_event(event)
