from __future__ import annotations

from typing import Any, AsyncIterator, Literal, Protocol

from pydantic import BaseModel, Field

ProviderName = Literal["anthropic", "openai", "mistral", "deepseek", "ollama"]
MessageRole = Literal["system", "user", "assistant"]
StreamingEventType = Literal["token", "complete", "error"]


class ChatMessage(BaseModel):
    role: MessageRole
    content: str = Field(min_length=1)


class GenerationRequest(BaseModel):
    provider: ProviderName | None = None
    model: str | None = None
    prompt: str | None = None
    messages: list[ChatMessage] = Field(default_factory=list)
    temperature: float = 0.2
    max_tokens: int = 512


class CompletionResult(BaseModel):
    provider: ProviderName
    model: str
    text: str
    finish_reason: str | None = None


class StreamingEvent(BaseModel):
    event: StreamingEventType
    data: dict[str, Any]


class LLMClient(Protocol):
    provider_name: ProviderName

    async def complete(self, request: GenerationRequest) -> CompletionResult: ...

    def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]: ...
