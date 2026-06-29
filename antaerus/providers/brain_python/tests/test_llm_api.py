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
    assert len(payload["providers"]) == 4


def test_llm_chat_endpoint_returns_completion(monkeypatch) -> None:
    class FakeClient:
        async def complete(self, request):
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


def test_llm_stream_endpoint_returns_sse(monkeypatch) -> None:
    class FakeClient:
        async def stream(self, request):
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
