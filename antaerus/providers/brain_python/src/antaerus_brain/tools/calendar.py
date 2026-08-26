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
    category = "calendar"
    autonomy_level = 2
    input_model = CalendarToolInput
    operations = ("list_upcoming", "create_event")

    def _google_oauth_url(self) -> str | None:
        cid = self.settings.google_client_id
        ruri = self.settings.google_redirect_uri
        if not cid or not ruri:
            return None
        scopes = (
            "https://www.googleapis.com/auth/calendar.readonly "
            "https://www.googleapis.com/auth/calendar.events "
            "https://www.googleapis.com/auth/userinfo.email"
        )
        from urllib.parse import urlencode

        params = {
            "client_id": cid,
            "redirect_uri": ruri,
            "response_type": "code",
            "scope": scopes,
            "access_type": "offline",
            "prompt": "consent",
        }
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)

    def _availability(self) -> ToolAvailability:
        if not self.settings.google_client_id:
            return ToolAvailability(
                enabled=True,
                available=False,
                reason=(
                    "google client id not configured — vérifier la variable "
                    "ANTAERUS_GOOGLE_CLIENT_ID dans .env OU le fichier "
                    "config/google_credentials.json (clé web.client_id / installed.client_id)"
                ),
            )
        if not self.settings.google_client_secret.get_secret_value():
            return ToolAvailability(
                enabled=True,
                available=False,
                reason=(
                    "google client secret not configured — vérifier la variable "
                    "ANTAERUS_GOOGLE_CLIENT_SECRET dans .env OU le fichier "
                    "config/google_credentials.json (clé web.client_secret / installed.client_secret)"
                ),
            )
        if not self.settings.google_refresh_token.get_secret_value():
            auth_url = self._google_oauth_url()
            reason = (
                "google refresh token not configured — lancer l'autorisation OAuth2 une fois "
                "et conserver le refresh_token dans ANTAERUS_GOOGLE_REFRESH_TOKEN (.env) OU "
                "config/google_token.json (clé refresh_token)."
            )
            if auth_url:
                reason += f" URL d'autorisation : {auth_url}"
            return ToolAvailability(
                enabled=True,
                available=False,
                reason=reason,
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
