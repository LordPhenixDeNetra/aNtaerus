from __future__ import annotations

from typing import Any, AsyncIterator, Literal, Protocol

from pydantic import BaseModel, Field

ProviderName = Literal["anthropic", "openai", "mistral", "deepseek", "ollama"]
MessageRole = Literal["system", "user", "assistant", "tool"]
StreamingEventType = Literal["token", "complete", "error"]


class ToolCallFunction(BaseModel):
    name: str
    arguments: str = "{}"


class ToolCall(BaseModel):
    id: str | None = None
    type: str = "function"
    function: ToolCallFunction


class ChatMessage(BaseModel):
    role: MessageRole
    content: str = ""
    name: str | None = None
    tool_call_id: str | None = Field(default=None, alias="toolCallId")
    tool_calls: list[ToolCall] = Field(default_factory=list, alias="toolCalls")


class ToolDefinition(BaseModel):
    type: str = "function"
    function: dict[str, Any]


class GenerationRequest(BaseModel):
    provider: ProviderName | None = None
    model: str | None = None
    prompt: str | None = None
    messages: list[ChatMessage] = Field(default_factory=list)
    temperature: float = 0.2
    max_tokens: int = 512
    tools: list[ToolDefinition] = Field(default_factory=list)
    tool_choice: str | None = None


class CompletionResult(BaseModel):
    provider: ProviderName
    model: str
    text: str
    finish_reason: str | None = None
    tool_calls: list[ToolCall] = Field(default_factory=list, alias="toolCalls")


class StreamingEvent(BaseModel):
    event: StreamingEventType
    data: dict[str, Any]


class LLMClient(Protocol):
    provider_name: ProviderName

    async def complete(self, request: GenerationRequest) -> CompletionResult: ...

    def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]: ...
