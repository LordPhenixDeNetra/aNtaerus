from __future__ import annotations

from fastapi.testclient import TestClient

from antaerus_brain.app import create_app
from antaerus_brain.config import get_settings
from antaerus_brain.llm import CompletionResult, StreamingEvent


def test_llm_providers_endpoint_lists_all_supported_providers() -> None:
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.get("/llm/providers")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["providers"]) == 5
    assert any(provider["name"] == "deepseek" for provider in payload["providers"])


def test_llm_chat_endpoint_returns_completion(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeClient:
        async def complete(self, request):
            captured["request"] = request
            return CompletionResult(
                provider="ollama",
                model="llama",
                text="Bonjour",
                finish_reason="stop",
            )

    monkeypatch.setattr(
        "antaerus_brain.api.llm.create_llm_client",
        lambda settings, provider=None: FakeClient(),
    )
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.post("/llm/chat", json={"prompt": "Bonjour"})

    assert response.status_code == 200
    assert response.json()["text"] == "Bonjour"
    assert "request" in captured
    llm_request = captured["request"]
    assert llm_request.messages[0].role == "system"
    assert "aNtaerus" in llm_request.messages[0].content
    assert any(message.role == "user" for message in llm_request.messages)


def test_llm_stream_endpoint_returns_sse(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeClient:
        async def stream(self, request):
            captured["request"] = request
            yield StreamingEvent(event="token", data={"text": "Bon"})
            yield StreamingEvent(event="complete", data={"text": "Bonjour"})

    monkeypatch.setattr(
        "antaerus_brain.api.llm.create_llm_client",
        lambda settings, provider=None: FakeClient(),
    )
    get_settings.cache_clear()
    client = TestClient(create_app())

    with client.stream("POST", "/llm/stream", json={"prompt": "Bonjour"}) as response:
        payload = b"".join(response.iter_bytes()).decode("utf-8")

    assert response.status_code == 200
    assert "event: token" in payload
    assert "event: complete" in payload
    assert "request" in captured
    llm_request = captured["request"]
    assert llm_request.messages[0].role == "system"
    assert "aNtaerus" in llm_request.messages[0].content
    assert any(message.role == "user" for message in llm_request.messages)


def test_llm_session_stream_endpoint_returns_session_aware_sse(tmp_path, monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeClient:
        provider_name = "ollama"

        def stream(self, request):
            captured["request"] = request

            async def generator():
                yield StreamingEvent(event="token", data={"text": "Bon"})
                yield StreamingEvent(event="complete", data={"text": "Bonjour"})

            return generator()

    monkeypatch.setenv("ANTAERUS_BRAIN_MEMORY_DB_PATH", str(tmp_path / "antaerus_memory.db"))
    monkeypatch.setattr(
        "antaerus_brain.chat.create_llm_client",
        lambda settings, provider=None: FakeClient(),
    )
    get_settings.cache_clear()
    client = TestClient(create_app())

    with client.stream(
        "POST",
        "/llm/session-stream",
        json={"sessionId": "session-1", "message": "Bonjour"},
    ) as response:
        payload = b"".join(response.iter_bytes()).decode("utf-8")

    assert response.status_code == 200
    assert "event: token" in payload
    assert '"sessionId": "session-1"' in payload
    assert "request" in captured
    llm_request = captured["request"]
    assert llm_request.messages[0].role == "system"
    assert "aNtaerus" in llm_request.messages[0].content
