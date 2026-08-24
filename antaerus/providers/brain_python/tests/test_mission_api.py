from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from antaerus_brain.app import create_app
from antaerus_brain.config import Settings
from antaerus_brain.llm import (
    CompletionResult,
    GenerationRequest,
    StreamingEvent,
)
from antaerus_brain.mission.schemas import Mission, MissionStep
from antaerus_brain.mission.state import MissionStateStore


class _FakeLLMClient:
    provider_name = "ollama"

    def __init__(self, responses: list[str] | None = None) -> None:
        self._responses = list(responses or [])
        self.calls: list[GenerationRequest] = []

    async def complete(self, request: GenerationRequest) -> CompletionResult:
        self.calls.append(request)
        if not self._responses:
            return CompletionResult(
                provider="ollama", model="fake",
                text='{"title":"Mission","plan":"...","steps":[{"index":0,"title":"Step0","description":"unique etape"}]}',
                finish_reason="stop",
            )
        return CompletionResult(
            provider="ollama", model="fake",
            text=self._responses.pop(0), finish_reason="stop",
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamingEvent]:
        r = await self.complete(request)
        yield StreamingEvent(event="token", data={"text": r.text})
        yield StreamingEvent(event="complete", data={"text": r.text, "provider": "ollama", "model": "fake"})


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    memory = tmp_path / "mem.db"
    fake_settings = Settings(
        service_name="brain_python",
        version="0.0.0",
        port=9111,
        environment="test",
        api_secret="sec",
        assistant_name="aNtaerus",
        assistant_system_prompt="",
        default_provider="ollama",
        anthropic_api_key="",
        openai_api_key="",
        mistral_api_key="",
        deepseek_api_key="",
        anthropic_model="",
        openai_model="",
        mistral_model="",
        deepseek_model="",
        ollama_base_url="http://localhost:1",
        ollama_model="",
        llm_timeout_seconds=1.0,
        memory_db_path=memory,
        memory_topics_dir=tmp_path / "topics",
        memory_default_limit=10,
        tools_config_path=tmp_path / "tools.yaml",
        tools_sandbox_root=tmp_path,
        tool_request_timeout_seconds=1.0,
        engine_base_url="http://localhost:2",
        browser_user_agent="",
        browser_timeout_seconds=1.0,
        weather_timeout_seconds=1.0,
        google_client_id="",
        google_client_secret="",
        google_refresh_token="",
        google_redirect_uri="",
        gmail_sender_email="",
        vision_model_path=None,
        vision_default_image_path=None,
        vision_enable_screen_capture=False,
        mission_max_steps=20,
        mission_llm_timeout_seconds=10.0,
        mission_recovery_enabled=True,
        mission_reflexion_enabled=True,
    )
    monkeypatch.setattr("antaerus_brain.config.get_settings", lambda: fake_settings)
    monkeypatch.setattr(
        "antaerus_brain.api.missions.create_llm_client",
        lambda settings, provider=None: _FakeLLMClient(responses=[
            '{"title":"M","plan":"Plan test","steps":[{"index":0,"title":"Etape unique","description":"demo"}]}',
        ]),
    )
    app = create_app()
    return TestClient(app)


def test_api_missions_create_and_list_and_get(client: TestClient):
    res = client.post("/missions", json={
        "session_id": "s1",
        "user_request": "test mission",
    })
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["status"] == "planned"
    assert data["session_id"] == "s1"
    assert len(data["steps"]) == 1
    mission_id = data["id"]

    listed = client.get("/missions").json()
    assert listed["total"] >= 1
    assert any(x["id"] == mission_id for x in listed["items"])

    listed_s1 = client.get("/missions", params={"sessionId": "s1"}).json()
    assert listed_s1["total"] >= 1

    got = client.get(f"/missions/{mission_id}").json()
    assert got["id"] == mission_id
    assert got["steps"][0]["status"] == "pending"


def test_api_missions_create_invalid_body(client: TestClient):
    res = client.post("/missions", json={"session_id": "x", "user_request": ""})
    assert res.status_code == 422


def test_api_missions_get_404(client: TestClient):
    res = client.get("/missions/does-not-exist")
    assert res.status_code == 404


def test_api_missions_run_conflict_if_completed(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import asyncio

    db_path = tmp_path / "db.db"
    fake_settings = Settings(
        service_name="brain_python",
        version="0.0.0",
        port=9112,
        environment="test",
        api_secret="sec",
        assistant_name="aNtaerus",
        assistant_system_prompt="",
        default_provider="ollama",
        anthropic_api_key="",
        openai_api_key="",
        mistral_api_key="",
        deepseek_api_key="",
        anthropic_model="",
        openai_model="",
        mistral_model="",
        deepseek_model="",
        ollama_base_url="http://localhost:1",
        ollama_model="",
        llm_timeout_seconds=1.0,
        memory_db_path=db_path,
        memory_topics_dir=tmp_path / "topics",
        memory_default_limit=10,
        tools_config_path=tmp_path / "tools.yaml",
        tools_sandbox_root=tmp_path,
        tool_request_timeout_seconds=1.0,
        engine_base_url="http://localhost:2",
        browser_user_agent="",
        browser_timeout_seconds=1.0,
        weather_timeout_seconds=1.0,
        google_client_id="",
        google_client_secret="",
        google_refresh_token="",
        google_redirect_uri="",
        gmail_sender_email="",
        vision_model_path=None,
        vision_default_image_path=None,
        vision_enable_screen_capture=False,
        mission_max_steps=20,
        mission_llm_timeout_seconds=10.0,
        mission_recovery_enabled=True,
        mission_reflexion_enabled=True,
    )

    def _fake_settings():
        return fake_settings

    monkeypatch.setattr("antaerus_brain.config.get_settings", _fake_settings)
    monkeypatch.setattr("antaerus_brain.api.missions.get_settings", _fake_settings)

    async def prep() -> str:
        state = MissionStateStore(db_path)
        await state.initialize()
        await state.create_mission(
            Mission(
                id="m-finished", title="F", user_request="u", status="completed",
                steps=[],
            )
        )
        return "m-finished"

    mission_id = asyncio.run(prep())
    from antaerus_brain.app import create_app

    app = create_app()
    c = TestClient(app)
    res = c.post(f"/missions/{mission_id}/run")
    assert res.status_code == 409, res.text


def test_api_missions_reflect_requires_terminal_status(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import asyncio

    db_path = tmp_path / "d.db"
    fake_settings = Settings(
        service_name="brain_python",
        version="0.0.0",
        port=9113,
        environment="test",
        api_secret="sec",
        assistant_name="aNtaerus",
        assistant_system_prompt="",
        default_provider="ollama",
        anthropic_api_key="",
        openai_api_key="",
        mistral_api_key="",
        deepseek_api_key="",
        anthropic_model="",
        openai_model="",
        mistral_model="",
        deepseek_model="",
        ollama_base_url="http://localhost:1",
        ollama_model="",
        llm_timeout_seconds=1.0,
        memory_db_path=db_path,
        memory_topics_dir=tmp_path / "topics",
        memory_default_limit=10,
        tools_config_path=tmp_path / "tools.yaml",
        tools_sandbox_root=tmp_path,
        tool_request_timeout_seconds=1.0,
        engine_base_url="http://localhost:2",
        browser_user_agent="",
        browser_timeout_seconds=1.0,
        weather_timeout_seconds=1.0,
        google_client_id="",
        google_client_secret="",
        google_refresh_token="",
        google_redirect_uri="",
        gmail_sender_email="",
        vision_model_path=None,
        vision_default_image_path=None,
        vision_enable_screen_capture=False,
        mission_max_steps=20,
        mission_llm_timeout_seconds=10.0,
        mission_recovery_enabled=True,
        mission_reflexion_enabled=True,
    )

    def _fake_settings():
        return fake_settings

    monkeypatch.setattr("antaerus_brain.config.get_settings", _fake_settings)
    monkeypatch.setattr("antaerus_brain.api.missions.get_settings", _fake_settings)

    async def prep() -> str:
        state = MissionStateStore(db_path)
        await state.initialize()
        await state.create_mission(
            Mission(
                id="m-run", title="R", user_request="u", status="running",
                steps=[MissionStep(id="s0", index=0, title="S0", status="pending")],
            )
        )
        return "m-run"

    mission_id = asyncio.run(prep())
    from antaerus_brain.app import create_app

    app = create_app()
    c = TestClient(app)
    res = c.post(f"/missions/{mission_id}/reflect")
    assert res.status_code == 409, res.text


def test_api_missions_events_round_trip(client: TestClient):
    created = client.post("/missions", json={
        "session_id": "s_ev",
        "user_request": "avec events",
    })
    assert created.status_code == 201
    mid = created.json()["id"]
    events = client.get(f"/missions/{mid}/events").json()
    assert events["items"] == []
