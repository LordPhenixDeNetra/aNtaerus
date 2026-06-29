from __future__ import annotations

from fastapi.testclient import TestClient

from antaerus_brain.app import create_app
from antaerus_brain.config import get_settings


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
