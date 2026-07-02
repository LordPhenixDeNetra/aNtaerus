from __future__ import annotations

import asyncio

from antaerus_brain.config import get_settings
from antaerus_brain.tools.browser import BrowserTool


class _FakeResponse:
    def __init__(self, text: str, url: str = "https://example.test") -> None:
        self.text = text
        self.url = url

    def raise_for_status(self) -> None:
        return None


class _FakeAsyncClient:
    def __init__(self, *args, **kwargs) -> None:
        self.requests: list[tuple[str, str]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url: str):
        self.requests.append(("GET", url))
        if "duckduckgo" in url:
            return _FakeResponse(
                '<a class="result__a" href="https://example.com/a">Premier résultat</a>'
            )
        return _FakeResponse("<html><title>Bonjour</title><body>Texte principal</body></html>", url)


def test_browser_tool_search_and_fetch(monkeypatch) -> None:
    monkeypatch.setattr("antaerus_brain.tools.browser.httpx.AsyncClient", _FakeAsyncClient)
    get_settings.cache_clear()
    tool = BrowserTool(get_settings(), {"enabled": True, "max_results": 3})

    search = asyncio.run(tool.execute({"operation": "search", "query": "antaerus"}))
    assert search.ok is True
    assert search.result["results"][0]["title"] == "Premier résultat"

    fetch = asyncio.run(tool.execute({"operation": "fetch", "url": "https://example.com/a"}))
    assert fetch.ok is True
    assert fetch.result["title"] == "Bonjour"
    assert "Texte principal" in fetch.result["text"]
