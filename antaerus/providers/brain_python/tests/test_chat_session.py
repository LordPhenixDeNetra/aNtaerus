from __future__ import annotations

import asyncio

from pydantic import SecretStr

from antaerus_brain.chat import SessionChatService, SessionStreamRequest
from antaerus_brain.config import Settings
from antaerus_brain.memory.kernel import MemoryKernel


def test_session_chat_service_isolates_histories(tmp_path, monkeypatch) -> None:
    class FakeClient:
        provider_name = "ollama"

        def stream(self, request):
            async def generator():
                yield type("Event", (), {"event": "token", "data": {"text": "Bon"}})()
                yield type("Event", (), {"event": "complete", "data": {"text": "Bonjour"}})()

            return generator()

    monkeypatch.setattr(
        "antaerus_brain.chat.create_llm_client",
        lambda settings, provider=None: FakeClient(),
    )

    settings = Settings(
        service_name="aNtaerus Brain",
        version="0.1.0",
        port=8000,
        environment="test",
        api_secret=SecretStr("secret"),
        default_provider="ollama",
        anthropic_api_key=SecretStr(""),
        openai_api_key=SecretStr(""),
        mistral_api_key=SecretStr(""),
        deepseek_api_key=SecretStr(""),
        anthropic_model="claude",
        openai_model="gpt",
        mistral_model="mistral",
        deepseek_model="deepseek/deepseek-chat",
        ollama_base_url="http://localhost:11434",
        ollama_model="llama3.1:8b",
        llm_timeout_seconds=30.0,
        memory_db_path=tmp_path / "antaerus_memory.db",
        memory_topics_dir=tmp_path / "topics",
        memory_default_limit=25,
    )

    async def scenario() -> None:
        service = SessionChatService(settings, MemoryKernel(settings.memory_db_path))

        async for _ in service.stream_session(
            SessionStreamRequest(sessionId="session-a", message="Bonjour"),
        ):
            pass
        async for _ in service.stream_session(
            SessionStreamRequest(sessionId="session-b", message="Salut"),
        ):
            pass

        first = await service.get_session_history("session-a")
        second = await service.get_session_history("session-b")

        assert [message.content for message in first.messages] == ["Bonjour", "Bonjour"]
        assert [message.content for message in second.messages] == ["Salut", "Bonjour"]

    asyncio.run(scenario())
