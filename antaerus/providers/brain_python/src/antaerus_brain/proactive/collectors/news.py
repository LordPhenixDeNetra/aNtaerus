from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import BaseModel

from antaerus_brain.proactive.collectors.base import (
    BaseCollector,
    CollectorAlert,
    CollectorBriefing,
    CollectorResult,
)


class NewsEntry(BaseModel):
    title: str
    link: str
    publishedAt: str | None = None
    source: str | None = None


class NewsCollector(BaseCollector):
    name = "news"
    description = "Digest RSS actualites"

    def __init__(self, settings, config: dict[str, Any] | None = None):
        super().__init__(settings, config)
        default_feeds = [
            {"name": "Le Monde", "url": "https://www.lemonde.fr/rss/une.xml"},
        ]
        self.feeds: list[dict[str, str]] = self.config.get("feeds") or default_feeds
        self.max_per_feed: int = int(self.config.get("max_per_feed", 3))
        timeout_val = getattr(self.settings, "tool_request_timeout_seconds", 15.0)
        self.request_timeout: float = float(timeout_val)

    async def _run_internal(self) -> CollectorResult:
        entries: list[NewsEntry] = []
        alerts: list[CollectorAlert] = []
        timeout = httpx.Timeout(self.request_timeout)
        for feed in self.feeds:
            url = feed.get("url")
            source = feed.get("name")
            if not isinstance(url, str) or not url:
                continue
            try:
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    feed_entries = self._parse_rss(resp.text, source=source)
                    entries.extend(feed_entries[: self.max_per_feed])
            except Exception as exc:  # noqa: BLE001
                alerts.append(CollectorAlert(
                    title="Flux RSS indisponible",
                    message=f"{source or url}: {exc}",
                    severity="warning",
                    source=self.name,
                ))
        summary = f"{len(entries)} articles extraits depuis {len(self.feeds)} flux"
        briefing = CollectorBriefing(
            title="Digest actualites",
            summary=summary,
            metadata={
                "entries": [e.model_dump() for e in entries],
                "feeds": self.feeds,
            },
        )
        return CollectorResult(
            collectorName=self.name,
            success=True,
            briefing=briefing,
            alerts=alerts,
        )

    def _parse_rss(self, xml_text: str, source: str | None = None) -> list[NewsEntry]:
        root = ET.fromstring(xml_text)
        items: list[NewsEntry] = []
        channel = root.find("channel")
        if channel is None:
            return items
        for element in channel.findall("item")[: self.max_per_feed]:
            title = self._text(element.find("title"))
            link = self._text(element.find("link"))
            pub_date = self._text(element.find("pubDate"))
            if not title or not link:
                continue
            published_at = None
            if pub_date:
                try:
                    dt = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %z")
                    published_at = dt.astimezone(timezone.utc).isoformat()
                except Exception:  # noqa: BLE001
                    published_at = pub_date
            items.append(NewsEntry(
                title=title,
                link=link,
                publishedAt=published_at,
                source=source,
            ))
        return items

    def _text(self, element: ET.Element | None) -> str | None:
        if element is None or element.text is None:
            return None
        return str(element.text).strip() or None
