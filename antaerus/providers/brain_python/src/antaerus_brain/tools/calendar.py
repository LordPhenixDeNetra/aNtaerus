from __future__ import annotations

from typing import Literal

import httpx
from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool, ToolAvailability
from antaerus_brain.tools.gmail import _exchange_google_refresh_token


class CalendarToolInput(BaseModel):
    operation: Literal["list_upcoming", "create_event"] = "list_upcoming"
    max_results: int = Field(default=5, ge=1, le=20)
    summary: str | None = None
    start: str | None = None
    end: str | None = None
    timezone: str = "UTC"


class CalendarTool(BaseTool):
    name = "calendar"
    description = "Liste ou cree des evenements simples via Google Calendar API"
    risk_level = "high"
    input_model = CalendarToolInput
    operations = ("list_upcoming", "create_event")

    def _availability(self) -> ToolAvailability:
        if not self.settings.google_client_id:
            return ToolAvailability(
                enabled=True,
                available=False,
                reason="google client id not configured",
            )
        if not self.settings.google_client_secret.get_secret_value():
            return ToolAvailability(
                enabled=True,
                available=False,
                reason="google client secret not configured",
            )
        if not self.settings.google_refresh_token.get_secret_value():
            return ToolAvailability(
                enabled=True,
                available=False,
                reason="google refresh token not configured",
            )
        return ToolAvailability(enabled=True, available=True)

    async def _run(self, payload: CalendarToolInput):
        if payload.operation == "create_event" and not self.config.get("allow_create", False):
            return self.denied("calendar create_event is disabled in config")

        access_token = await _exchange_google_refresh_token(
            self.settings.google_client_id,
            self.settings.google_client_secret.get_secret_value(),
            self.settings.google_refresh_token.get_secret_value(),
            self.settings.tool_request_timeout_seconds,
        )
        headers = {"Authorization": f"Bearer {access_token}"}
        timeout = httpx.Timeout(self.settings.tool_request_timeout_seconds)
        async with httpx.AsyncClient(
            timeout=timeout,
            headers=headers,
            follow_redirects=True,
        ) as client:
            if payload.operation == "list_upcoming":
                response = await client.get(
                    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                    params={
                        "maxResults": payload.max_results,
                        "singleEvents": "true",
                        "orderBy": "startTime",
                        "timeMin": payload.start,
                    },
                )
                response.raise_for_status()
                return self.success(response.json())

            if not payload.summary or not payload.start or not payload.end:
                return self.error_result("summary, start and end are required for create_event")

            response = await client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                json={
                    "summary": payload.summary,
                    "start": {"dateTime": payload.start, "timeZone": payload.timezone},
                    "end": {"dateTime": payload.end, "timeZone": payload.timezone},
                },
            )
            response.raise_for_status()
            return self.success(response.json())
