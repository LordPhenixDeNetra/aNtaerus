from __future__ import annotations

from typing import Any, AsyncIterator

from pydantic import SecretStr

from antaerus_brain.llm import (
    CompletionResult,
    GenerationRequest,
    LLMClient,
    ProviderName,
    StreamingEvent,
)

try:
    from litellm import acompletion
except ImportError:  # pragma: no cover - dependency is installed during validation
    acompletion = None


class CloudLLMClient(LLMClient):
    def __init__(
        self,
        provider_name: ProviderName,
        api_key: SecretStr,
        default_model: str,
        timeout_seconds: float,
    ) -> None:
        self.provider_name = provider_name
        self.api_key = api_key
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds

    async def complete(self, request: GenerationRequest) -> CompletionResult:
        response = await self._acompletion(request, stream=False)
        choice = self._first_choice(response)
        return CompletionResult(
            provider=self.provider_name,
            model=request.model or self.default_model,
            text=self._choice_text(choice),
            finish_reason=self._choice_finish_reason(choice),
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]:
        stream = await self._acompletion(request, stream=True)
        collected: list[str] = []

        async for chunk in stream:
            piece = self._chunk_text(chunk)
            if piece:
                collected.append(piece)
                yield StreamingEvent(event="token", data={"text": piece})

        yield StreamingEvent(
            event="complete",
            data={
                "text": "".join(collected),
                "provider": self.provider_name,
                "model": request.model or self.default_model,
            },
        )

    async def _acompletion(self, request: GenerationRequest, *, stream: bool) -> Any:
        if acompletion is None:
            raise RuntimeError("litellm is not installed")
        if not self.api_key.get_secret_value():
            raise RuntimeError(f"API key for provider {self.provider_name} is not configured")

        return await acompletion(
            model=request.model or self.default_model,
            messages=_request_messages(request),
            api_key=self.api_key.get_secret_value(),
            timeout=self.timeout_seconds,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=stream,
        )

    @staticmethod
    def _first_choice(response: Any) -> Any:
        choices = getattr(response, "choices", None)
        if choices is None and isinstance(response, dict):
            choices = response.get("choices")
        if not choices:
            raise RuntimeError("LLM response did not contain choices")
        return choices[0]

    @staticmethod
    def _choice_text(choice: Any) -> str:
        message = getattr(choice, "message", None)
        if message is None and isinstance(choice, dict):
            message = choice.get("message", {})
        if message is not None and hasattr(message, "content"):
            return message.content or ""
        if isinstance(message, dict):
            return str(message.get("content", ""))
        return ""

    @staticmethod
    def _choice_finish_reason(choice: Any) -> str | None:
        if hasattr(choice, "finish_reason"):
            return choice.finish_reason
        if isinstance(choice, dict):
            return choice.get("finish_reason")
        return None

    @staticmethod
    def _chunk_text(chunk: Any) -> str:
        choices = getattr(chunk, "choices", None)
        if choices is None and isinstance(chunk, dict):
            choices = chunk.get("choices")
        if not choices:
            return ""

        first = choices[0]
        delta = getattr(first, "delta", None)
        if delta is None and isinstance(first, dict):
            delta = first.get("delta", {})

        if delta is not None and hasattr(delta, "content"):
            return delta.content or ""
        if isinstance(delta, dict):
            return str(delta.get("content", ""))
        return ""


def _request_messages(request: GenerationRequest) -> list[dict[str, str]]:
    if request.messages:
        return [{"role": message.role, "content": message.content} for message in request.messages]
    if request.prompt:
        return [{"role": "user", "content": request.prompt}]

    raise ValueError("Generation request requires either prompt or messages")
