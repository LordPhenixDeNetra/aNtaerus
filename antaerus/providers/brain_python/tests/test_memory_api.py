from __future__ import annotations

from fastapi.testclient import TestClient

from antaerus_brain.app import create_app
from antaerus_brain.config import get_settings
from antaerus_brain.llm import StreamingEvent


def test_memory_ingest_and_search_endpoints(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ANTAERUS_BRAIN_MEMORY_DB_PATH", str(tmp_path / "antaerus_memory.db"))
    monkeypatch.setenv("ANTAERUS_BRAIN_MEMORY_TOPICS_DIR", str(tmp_path / "topics"))
    get_settings.cache_clear()
    client = TestClient(create_app())

    ingest = client.post(
        "/memory/ingest",
        json={"text": "J'aime Python. Je travaille sur Hopitalia."},
    )
    assert ingest.status_code == 200
    assert ingest.json()["ingestedCount"] >= 2

    search = client.get("/memory/facts", params={"query": "Hopitalia"})
    assert search.status_code == 200
    assert len(search.json()["facts"]) == 1


def test_memory_mirror_endpoint_generates_markdown(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ANTAERUS_BRAIN_MEMORY_DB_PATH", str(tmp_path / "antaerus_memory.db"))
    monkeypatch.setenv("ANTAERUS_BRAIN_MEMORY_TOPICS_DIR", str(tmp_path / "topics"))
    get_settings.cache_clear()
    client = TestClient(create_app())

    create = client.post(
        "/memory/facts",
        json={
            "subject": "user",
            "predicate": "likes",
            "object": "Python",
            "category": "preferences",
            "confidence": 0.8,
        },
    )
    assert create.status_code == 200

    mirror = client.post("/memory/mirror")
    assert mirror.status_code == 200
    generated = mirror.json()["generated_files"]
    assert generated
    assert generated[0].endswith("preferences.md")


def test_memory_chat_history_endpoint_returns_session_messages(tmp_path, monkeypatch) -> None:
    class FakeClient:
        provider_name = "ollama"

        def stream(self, request):
            async def generator():
                yield StreamingEvent(event="token", data={"text": "Bon"})
                yield StreamingEvent(event="complete", data={"text": "Bonjour"})

            return generator()

    monkeypatch.setenv("ANTAERUS_BRAIN_MEMORY_DB_PATH", str(tmp_path / "antaerus_memory.db"))
    monkeypatch.setenv("ANTAERUS_BRAIN_MEMORY_TOPICS_DIR", str(tmp_path / "topics"))
    monkeypatch.setattr(
        "antaerus_brain.api.llm.create_llm_client",
        lambda settings, provider=None: FakeClient(),
    )
    get_settings.cache_clear()
    client = TestClient(create_app())

    first = client.post(
        "/llm/session-stream",
        json={"sessionId": "session-history", "message": "Bonjour"},
    )
    assert first.status_code == 200

    history = client.get("/memory/chat/sessions/session-history")
    assert history.status_code == 200
    payload = history.json()
    assert payload["sessionId"] == "session-history"
    assert payload["messages"][0]["role"] == "user"
