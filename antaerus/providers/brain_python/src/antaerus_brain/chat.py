from __future__ import annotations

from collections.abc import AsyncIterator

from pydantic import BaseModel, Field

from antaerus_brain.config import Settings
from antaerus_brain.llm import ProviderName, StreamingEvent
from antaerus_brain.llm.factory import create_llm_client
from antaerus_brain.memory import ChatHistoryResponse
from antaerus_brain.memory.kernel import MemoryKernel
from antaerus_brain.prompting import inject_system_prompt, is_identity_question


class SessionStreamRequest(BaseModel):
    session_id: str = Field(alias="sessionId", min_length=1)
    message: str = Field(min_length=1)
    provider: ProviderName | None = None


class SessionChatService:
    def __init__(self, settings: Settings, kernel: MemoryKernel) -> None:
        self.settings = settings
        self.kernel = kernel

    async def stream_session(self, request: SessionStreamRequest) -> AsyncIterator[StreamingEvent]:
        await self.kernel.initialize()
        if is_identity_question(request.message):
            name = self.settings.assistant_name.strip() or "aNtaerus"
            response_text = "Je suis aNtaerus, un assistant IA open source."
            if name != "aNtaerus":
                response_text = f"Je suis {name}, un assistant IA open source."

            await self.kernel.append_chat_message(
                request.session_id,
                role="user",
                content=request.message,
                provider=request.provider,
            )
            yield StreamingEvent(
                event="complete",
                data={
                    "sessionId": request.session_id,
                    "text": response_text,
                    "provider": request.provider or self.settings.default_provider,
                },
            )
            await self.kernel.append_chat_message(
                request.session_id,
                role="assistant",
                content=response_text,
                provider=request.provider or self.settings.default_provider,
            )
            return

        client = create_llm_client(self.settings, provider=request.provider)

        await self.kernel.append_chat_message(
            request.session_id,
            role="user",
            content=request.message,
            provider=request.provider,
        )
        generation_messages = await self.kernel.build_generation_messages(request.session_id)

        final_text = ""
        try:
            generation_request = inject_system_prompt(
                self.settings,
                self._generation_request(
                    request.message,
                    generation_messages,
                    request.provider,
                ),
            )
            async for event in client.stream(
                request=generation_request,
            ):
                data = dict(event.data)
                data["sessionId"] = request.session_id

                if event.event == "token":
                    final_text += str(data.get("text", ""))
                elif event.event == "complete":
                    final_text = str(data.get("text", final_text))

                yield StreamingEvent(event=event.event, data=data)
        except Exception as exc:
            yield StreamingEvent(
                event="error",
                data={
                    "sessionId": request.session_id,
                    "message": str(exc),
                },
            )
            return

        if final_text:
            await self.kernel.append_chat_message(
                request.session_id,
                role="assistant",
                content=final_text,
                provider=client.provider_name,
            )

    async def get_session_history(self, session_id: str) -> ChatHistoryResponse:
        await self.kernel.initialize()
        messages = await self.kernel.list_chat_messages(session_id)
        return ChatHistoryResponse(
            sessionId=session_id,
            messages=messages,
        )

    @staticmethod
    def _generation_request(message: str, messages, provider: ProviderName | None):
        from antaerus_brain.llm import GenerationRequest

        return GenerationRequest(
            provider=provider,
            prompt=message,
            messages=messages,
        )
