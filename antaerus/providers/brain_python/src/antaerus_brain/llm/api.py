from __future__ import annotations

from typing import Any, AsyncIterator

from pydantic import SecretStr

from antaerus_brain.llm import (
    CompletionResult,
    GenerationRequest,
    LLMClient,
    ProviderName,
    StreamingEvent,
    ToolCall,
    ToolCallFunction,
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
            toolCalls=self._choice_tool_calls(choice),
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
            tools=[tool.model_dump() for tool in request.tools] or None,
            tool_choice=request.tool_choice,
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
    def _choice_tool_calls(choice: Any) -> list[ToolCall]:
        message = getattr(choice, "message", None)
        if message is None and isinstance(choice, dict):
            message = choice.get("message", {})

        raw_tool_calls = getattr(message, "tool_calls", None)
        if raw_tool_calls is None and isinstance(message, dict):
            raw_tool_calls = message.get("tool_calls", [])
        if not raw_tool_calls:
            return []

        parsed: list[ToolCall] = []
        for entry in raw_tool_calls:
            function = getattr(entry, "function", None)
            if function is None and isinstance(entry, dict):
                function = entry.get("function", {})
            entry_id = (
                getattr(entry, "id", None)
                if not isinstance(entry, dict)
                else entry.get("id")
            )
            entry_type = (
                getattr(entry, "type", "function")
                if not isinstance(entry, dict)
                else entry.get("type", "function")
            )
            function_name = _tool_call_value(function, "name", "")
            function_arguments = _tool_call_value(function, "arguments", "{}")
            parsed.append(
                ToolCall(
                    id=entry_id,
                    type=entry_type,
                    function=ToolCallFunction(
                        name=function_name,
                        arguments=function_arguments,
                    ),
                )
            )
        return parsed

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


def _request_messages(request: GenerationRequest) -> list[dict[str, Any]]:
    if request.messages:
        payload: list[dict[str, Any]] = []
        for message in request.messages:
            item: dict[str, Any] = {"role": message.role, "content": message.content}
            if message.name:
                item["name"] = message.name
            if message.tool_call_id:
                item["tool_call_id"] = message.tool_call_id
            if message.tool_calls:
                item["tool_calls"] = [tool_call.model_dump() for tool_call in message.tool_calls]
            payload.append(item)
        return payload
    if request.prompt:
        return [{"role": "user", "content": request.prompt}]

    raise ValueError("Generation request requires either prompt or messages")


def _tool_call_value(function: Any, key: str, default: str) -> str:
    if isinstance(function, dict):
        value = function.get(key, default)
    else:
        value = getattr(function, key, default)
    return value if isinstance(value, str) else default
