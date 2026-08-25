from __future__ import annotations

from typing import Any, cast

import httpx

from antaerus_brain.proactive.collectors.base import (
    BaseCollector,
    CollectorAlert,
    CollectorBriefing,
    CollectorResult,
    CollectorSeverity,
)


class CustomCollector(BaseCollector):
    name = "custom"
    description = "Collecteur HTTP generique configurable"

    def __init__(self, settings, config: dict[str, Any] | None = None):
        super().__init__(settings, config)
        inner_name = self.config.get("name")
        if isinstance(inner_name, str) and inner_name:
            self.name = f"custom.{inner_name}"
            self.description = str(self.config.get("description", self.description))
        self.url: str = str(self.config.get("url", ""))
        self.method: str = str(self.config.get("method", "GET")).upper()
        self.headers: dict[str, str] = dict(self.config.get("headers") or {})
        timeout_raw = self.config.get("timeout_seconds")
        if isinstance(timeout_raw, (int, float)):
            self.timeout_s: float = float(timeout_raw)
        else:
            settings_timeout = getattr(
                self.settings, "tool_request_timeout_seconds", 15.0
            )
            settings_val = (
                settings_timeout
                if isinstance(settings_timeout, (int, float))
                else 15.0
            )
            self.timeout_s = float(settings_val)
        self.expected_statuses: list[int] = list(self.config.get("expected_statuses") or [200])
        self.severity_on_error: str = str(self.config.get("severity_on_error", "warning"))

    async def _run_internal(self) -> CollectorResult:
        if not self.url:
            return CollectorResult(
                collectorName=self.name,
                success=False,
                error="url is required for custom collector",
            )
        timeout = httpx.Timeout(self.timeout_s)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.request(self.method, self.url, headers=self.headers or None)
        ok = resp.status_code in self.expected_statuses
        body_snippet: str = ""
        try:
            body_snippet = resp.text[:1000]
        except Exception:  # noqa: BLE001
            body_snippet = ""
        alerts: list[CollectorAlert] = []
        if not ok:
            alert_severity: CollectorSeverity
            if self.severity_on_error in {"info", "warning", "critical"}:
                alert_severity = cast(CollectorSeverity, self.severity_on_error)
            else:
                alert_severity = "warning"
            alerts.append(CollectorAlert(
                title=f"Collecteur {self.name} HTTP {resp.status_code}",
                message=f"statut attendu {self.expected_statuses}, recu {resp.status_code}",
                severity=alert_severity,
                source=self.name,
            ))
        briefing = CollectorBriefing(
            title=f"Collecteur custom {self.name}",
            summary=f"HTTP {self.method} {self.url} -> {resp.status_code}",
            metadata={
                "url": self.url,
                "method": self.method,
                "status": resp.status_code,
                "body": body_snippet,
            },
        )
        return CollectorResult(
            collectorName=self.name,
            success=ok,
            briefing=briefing,
            alerts=alerts,
            error=None if ok else f"unexpected HTTP status {resp.status_code}",
        )
