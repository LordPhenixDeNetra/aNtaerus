from __future__ import annotations

import re
from html import unescape
from html.parser import HTMLParser
from typing import Literal
from urllib.parse import parse_qs, quote_plus, urlparse

import httpx
from pydantic import BaseModel, Field, HttpUrl

from antaerus_brain.tools.base import BaseTool


class BrowserToolInput(BaseModel):
    operation: Literal["search", "fetch"] = "search"
    query: str | None = Field(default=None, min_length=1)
    url: HttpUrl | None = None
    max_results: int | None = Field(default=None, ge=1, le=10)


class BrowserTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.title: str = ""
        self._inside_title = False

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() == "title":
            self._inside_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._inside_title = False

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if not text:
            return
        if self._inside_title and not self.title:
            self.title = text
        self.parts.append(text)

    def text(self) -> str:
        return " ".join(self.parts).strip()


class BrowserTool(BaseTool):
    name = "browser"
    description = "Recherche web simple et extraction textuelle d'une page HTML"
    risk_level = "low"
    input_model = BrowserToolInput
    operations = ("search", "fetch")

    async def _run(self, payload: BrowserToolInput):
        timeout = httpx.Timeout(self.settings.browser_timeout_seconds)
        headers = {"User-Agent": self.settings.browser_user_agent}
        async with httpx.AsyncClient(
            timeout=timeout,
            headers=headers,
            follow_redirects=True,
        ) as client:
            if payload.operation == "search":
                if not payload.query:
                    return self.error_result("query is required for search")
                return self.success(await self._search(client, payload.query, payload.max_results))

            if payload.url is None:
                return self.error_result("url is required for fetch")
            return self.success(await self._fetch(client, str(payload.url)))

    async def _search(
        self,
        client: httpx.AsyncClient,
        query: str,
        max_results: int | None,
    ) -> dict[str, object]:
        configured_max = int(self.config.get("max_results", 5))
        limit = max_results or configured_max
        response = await client.get(
            f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        )
        response.raise_for_status()
        results = _extract_search_results(response.text, limit)
        return {
            "query": query,
            "results": results,
            "count": len(results),
        }

    async def _fetch(self, client: httpx.AsyncClient, url: str) -> dict[str, object]:
        response = await client.get(url)
        response.raise_for_status()
        extractor = BrowserTextExtractor()
        extractor.feed(response.text)
        text = extractor.text()
        excerpt = text[:2000]
        return {
            "url": str(response.url),
            "title": extractor.title,
            "text": excerpt,
            "truncated": len(text) > len(excerpt),
        }


def _extract_search_results(html: str, limit: int) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    pattern = re.compile(
        r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
        re.IGNORECASE | re.DOTALL,
    )
    for match in pattern.finditer(html):
        href = unescape(match.group("href"))
        title = _strip_html(match.group("title"))
        results.append({"title": title, "url": _resolve_search_href(href)})
        if len(results) >= limit:
            return results

    fallback_pattern = re.compile(r'<a[^>]+href="(?P<href>https?://[^"]+)"[^>]*>(?P<title>.*?)</a>')
    for match in fallback_pattern.finditer(html):
        title = _strip_html(match.group("title"))
        if not title:
            continue
        results.append({"title": title, "url": match.group("href")})
        if len(results) >= limit:
            break
    return results


def _resolve_search_href(raw_href: str) -> str:
    parsed = urlparse(raw_href)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        if parsed.netloc.endswith("duckduckgo.com"):
            query = parse_qs(parsed.query)
            uddg = query.get("uddg")
            if uddg:
                return unescape(uddg[0])
        return raw_href
    return raw_href


def _strip_html(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    return " ".join(unescape(value).split())
