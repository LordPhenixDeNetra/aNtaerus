from __future__ import annotations

import asyncio

from antaerus_brain.config import get_settings
from antaerus_brain.tools.calendar import CalendarTool


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, *args, **kwargs) -> None:
        self.created_payload = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url: str, params=None):
        return _FakeResponse({"items": []})

    async def post(self, url: str, json=None):
        self.created_payload = json
        return _FakeResponse({"id": "event-1", "summary": json["summary"]})


def test_calendar_tool_creates_event_when_enabled(monkeypatch) -> None:
    monkeypatch.setenv("ANTAERUS_GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("ANTAERUS_GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("ANTAERUS_GOOGLE_REFRESH_TOKEN", "refresh-token")
    monkeypatch.setattr(
        "antaerus_brain.tools.calendar._exchange_google_refresh_token",
        lambda *args, **kwargs: asyncio.sleep(0, result="token"),
    )
    monkeypatch.setattr("antaerus_brain.tools.calendar.httpx.AsyncClient", _FakeAsyncClient)
    get_settings.cache_clear()

    tool = CalendarTool(get_settings(), {"enabled": True, "allow_create": True})
    result = asyncio.run(
        tool.execute(
            {
                "operation": "create_event",
                "summary": "Reunion",
                "start": "2026-07-03T10:00:00Z",
                "end": "2026-07-03T11:00:00Z",
            }
        )
    )

    assert result.ok is True
    assert result.result["summary"] == "Reunion"
