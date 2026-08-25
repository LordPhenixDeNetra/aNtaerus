from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from pydantic import BaseModel

from antaerus_brain.proactive.collectors.base import (
    BaseCollector,
    CollectorAlert,
    CollectorBriefing,
    CollectorResult,
)


def _exchange_google_refresh_token(
    client_id: str,
    client_secret: str,
    refresh_token: str,
    timeout_s: float,
) -> str:
    timeout = httpx.Timeout(timeout_s)
    with httpx.Client(timeout=timeout) as client:
        resp = client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        token = resp.json().get("access_token")
        if not isinstance(token, str) or not token:
            raise ValueError("google access token missing in refresh response")
        return token


class CalendarEvent(BaseModel):
    id: str
    summary: str | None = None
    start: str | None = None
    end: str | None = None
    htmlLink: str | None = None
    inNextHours: int = 0


class CalendarCollector(BaseCollector):
    name = "calendar"
    description = "Rappels calendrier 24h Google Calendar API"

    def __init__(self, settings, config: dict[str, Any] | None = None):
        super().__init__(settings, config)
        self.horizon_hours: int = int(self.config.get("horizon_hours", 24))
        self.max_results: int = int(self.config.get("max_results", 10))
        self.reminder_hours_before: int = int(self.config.get("reminder_hours_before", 1))

    async def _run_internal(self) -> CollectorResult:
        settings = self.settings
        client_id = getattr(settings, "google_client_id", "") or ""
        client_secret = getattr(settings, "google_client_secret", None)
        refresh_token = getattr(settings, "google_refresh_token", None)
        client_secret_value = client_secret.get_secret_value() if client_secret is not None else ""
        refresh_token_value = refresh_token.get_secret_value() if refresh_token is not None else ""
        if not client_id or not client_secret_value or not refresh_token_value:
            return CollectorResult(
                collectorName=self.name,
                success=True,
                briefing=CollectorBriefing(
                    title="Calendrier indisponible",
                    summary="Google OAuth non configure dans les settings",
                ),
                alerts=[],
            )
        timeout_s = float(getattr(settings, "tool_request_timeout_seconds", 15.0))
        access_token = _exchange_google_refresh_token(
            client_id,
            client_secret_value,
            refresh_token_value,
            timeout_s,
        )
        now = datetime.now(timezone.utc)
        horizon = now + timedelta(hours=self.horizon_hours)
        params = {
            "maxResults": str(self.max_results),
            "singleEvents": "true",
            "orderBy": "startTime",
            "timeMin": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "timeMax": horizon.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        headers = {"Authorization": f"Bearer {access_token}"}
        timeout = httpx.Timeout(timeout_s)
        async with httpx.AsyncClient(
            timeout=timeout,
            headers=headers,
            follow_redirects=True,
        ) as client:
            resp = await client.get(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                params=params,
            )
            resp.raise_for_status()
            payload = resp.json()
        events_raw = payload.get("items") or []
        events: list[CalendarEvent] = []
        alerts: list[CollectorAlert] = []
        for ev in events_raw:
            start = (ev.get("start") or {}).get("dateTime") or (ev.get("start") or {}).get("date")
            end = (ev.get("end") or {}).get("dateTime") or (ev.get("end") or {}).get("date")
            event = CalendarEvent(
                id=ev.get("id") or "",
                summary=ev.get("summary"),
                start=start,
                end=end,
                htmlLink=ev.get("htmlLink"),
            )
            if isinstance(start, str):
                try:
                    dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
                    delta = dt - now
                    event.inNextHours = max(0, int(delta.total_seconds() // 3600))
                    if 0 <= delta.total_seconds() // 3600 <= self.reminder_hours_before:
                        summary_label = event.summary or "evenement"
                        alerts.append(CollectorAlert(
                            title="Rappel evenement",
                            message=(
                                f"{summary_label} commence "
                                f"dans {event.inNextHours} h"
                            ),
                            severity="info",
                            source=self.name,
                        ))
                except Exception:  # noqa: BLE001
                    pass
            events.append(event)
        briefing = CollectorBriefing(
            title="Rappels calendrier",
            summary=f"{len(events)} evenements dans les {self.horizon_hours} h",
            metadata={"events": [e.model_dump() for e in events]},
        )
        return CollectorResult(
            collectorName=self.name,
            success=True,
            briefing=briefing,
            alerts=alerts,
        )
