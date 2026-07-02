from __future__ import annotations

import asyncio

from antaerus_brain.config import get_settings
from antaerus_brain.tools.gmail import GmailTool


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, *args, **kwargs) -> None:
        self.calls: list[tuple[str, str]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url: str, params=None):
        self.calls.append(("GET", url))
        return _FakeResponse({"messages": [{"id": "msg-1"}]})


def test_gmail_tool_lists_recent_messages(monkeypatch) -> None:
    monkeypatch.setenv("ANTAERUS_GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("ANTAERUS_GOOGLE_CLIENT_SECRET", "client-secret")
    monkeypatch.setenv("ANTAERUS_GOOGLE_REFRESH_TOKEN", "refresh-token")
    monkeypatch.setattr(
        "antaerus_brain.tools.gmail._exchange_google_refresh_token",
        lambda *args, **kwargs: asyncio.sleep(0, result="token"),
    )
    monkeypatch.setattr("antaerus_brain.tools.gmail.httpx.AsyncClient", _FakeAsyncClient)
    get_settings.cache_clear()

    tool = GmailTool(get_settings(), {"enabled": True, "allow_send": False})
    result = asyncio.run(tool.execute({"operation": "list_recent", "max_results": 3}))

    assert result.ok is True
    assert result.result["messages"][0]["id"] == "msg-1"
