from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from antaerus_brain.llm import CompletionResult, GenerationRequest, LLMClient, StreamingEvent


class OllamaLLMClient(LLMClient):
    provider_name = "ollama"

    def __init__(self, base_url: str, default_model: str, timeout_seconds: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds

    async def complete(self, request: GenerationRequest) -> CompletionResult:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json=_request_payload(request, request.model or self.default_model, stream=False),
            )
            response.raise_for_status()
            payload = response.json()

        return CompletionResult(
            provider="ollama",
            model=request.model or self.default_model,
            text=str(payload.get("message", {}).get("content", "")),
            finish_reason="stop" if payload.get("done") else None,
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]:
        collected: list[str] = []
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json=_request_payload(request, request.model or self.default_model, stream=True),
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue

                    payload = json.loads(line)
                    piece = str(payload.get("message", {}).get("content", ""))
                    if piece:
                        collected.append(piece)
                        yield StreamingEvent(event="token", data={"text": piece})

                    if payload.get("done"):
                        yield StreamingEvent(
                            event="complete",
                            data={
                                "text": "".join(collected),
                                "provider": "ollama",
                                "model": request.model or self.default_model,
                            },
                        )
                        return


def _request_payload(request: GenerationRequest, model: str, *, stream: bool) -> dict[str, object]:
    if request.messages:
        messages = [
            {"role": message.role, "content": message.content}
            for message in request.messages
        ]
    elif request.prompt:
        messages = [{"role": "user", "content": request.prompt}]
    else:
        raise ValueError("Generation request requires either prompt or messages")

    return {
        "model": model,
        "messages": messages,
        "stream": stream,
        "options": {
            "temperature": request.temperature,
            "num_predict": request.max_tokens,
        },
    }
