from __future__ import annotations

import asyncio
import json

from pydantic import SecretStr

from antaerus_brain.chat import SessionChatService, SessionStreamRequest
from antaerus_brain.config import Settings
from antaerus_brain.llm import CompletionResult, ToolCall, ToolCallFunction
from antaerus_brain.memory.kernel import MemoryKernel


def test_session_chat_service_isolates_histories(tmp_path, monkeypatch) -> None:
    class FakeClient:
        provider_name = "ollama"

        async def complete(self, request):
            return CompletionResult(
                provider="ollama",
                model="llama",
                text="Bonjour",
                finish_reason="stop",
            )

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
        assistant_name="aNtaerus",
        assistant_system_prompt="",
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


def test_session_chat_service_executes_tool_call_and_returns_final_text(
    tmp_path, monkeypatch
) -> None:
    browser_html = '<a class="result__a" href="https://example.com/a">Premier résultat</a>'

    class FakeBrowserResponse:
        def __init__(self, text: str, url: str = "https://example.com") -> None:
            self.text = text
            self.url = url

        def raise_for_status(self) -> None:
            return None

    class FakeBrowserClient:
        def __init__(self, *args, **kwargs) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url: str):
            if "duckduckgo" in url:
                return FakeBrowserResponse(browser_html)
            return FakeBrowserResponse(
                "<html><title>Bonjour</title><body>Texte principal</body></html>",
                url,
            )

    class FakeClient:
        provider_name = "ollama"

        async def complete(self, request):
            if request.tools:
                return CompletionResult(
                    provider="ollama",
                    model="llama",
                    text="",
                    finish_reason="tool_calls",
                    toolCalls=[
                        ToolCall(
                            id="call-1",
                            function=ToolCallFunction(
                                name="browser",
                                arguments=json.dumps(
                                    {"operation": "search", "query": "aNtaerus"}
                                ),
                            ),
                        )
                    ],
                )
            return CompletionResult(
                provider="ollama",
                model="llama",
                text="Resume final navigateur",
                finish_reason="stop",
            )

    monkeypatch.setattr(
        "antaerus_brain.chat.create_llm_client",
        lambda settings, provider=None: FakeClient(),
    )
    monkeypatch.setattr("antaerus_brain.tools.browser.httpx.AsyncClient", FakeBrowserClient)

    settings = Settings(
        service_name="aNtaerus Brain",
        version="0.1.0",
        port=8000,
        environment="test",
        api_secret=SecretStr("secret"),
        assistant_name="aNtaerus",
        assistant_system_prompt="",
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
        events = [
            event
            async for event in service.stream_session(
                SessionStreamRequest(sessionId="session-tool", message="Cherche aNtaerus")
            )
        ]
        assert events[-1].event == "complete"
        assert events[-1].data["text"] == "Resume final navigateur"

    asyncio.run(scenario())
