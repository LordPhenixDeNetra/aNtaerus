from __future__ import annotations

import base64
from email.message import EmailMessage
from typing import Literal

import httpx
from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool, ToolAvailability


class GmailToolInput(BaseModel):
    operation: Literal["list_recent", "send"] = "list_recent"
    max_results: int = Field(default=5, ge=1, le=20)
    to: list[str] = Field(default_factory=list)
    subject: str | None = None
    body: str | None = None


class GmailTool(BaseTool):
    name = "gmail"
    description = "Liste des emails recents et envoi simple via Gmail API"
    risk_level = "high"
    category = "communication"
    autonomy_level = 2
    input_model = GmailToolInput
    operations = ("list_recent", "send")

    def _google_oauth_url(self) -> str | None:
        cid = self.settings.google_client_id
        ruri = self.settings.google_redirect_uri
        if not cid or not ruri:
            return None
        scopes = (
            "https://www.googleapis.com/auth/gmail.readonly "
            "https://www.googleapis.com/auth/gmail.send "
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

    async def _run(self, payload: GmailToolInput):
        if payload.operation == "send" and not self.config.get("allow_send", False):
            return self.denied("gmail send is disabled in config")

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
            if payload.operation == "list_recent":
                response = await client.get(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                    params={"maxResults": payload.max_results},
                )
                response.raise_for_status()
                return self.success(response.json())

            if not payload.to or not payload.subject or not payload.body:
                return self.error_result("to, subject and body are required for send")

            if not self.settings.gmail_sender_email:
                return self.not_configured("gmail sender email not configured")

            message = EmailMessage()
            message["From"] = self.settings.gmail_sender_email
            message["To"] = ", ".join(payload.to)
            message["Subject"] = payload.subject
            message.set_content(payload.body)
            raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
            response = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                json={"raw": raw},
            )
            response.raise_for_status()
            return self.success(response.json())


async def _exchange_google_refresh_token(
    client_id: str,
    client_secret: str,
    refresh_token: str,
    timeout_seconds: float,
) -> str:
    timeout = httpx.Timeout(timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        response.raise_for_status()
        return response.json()["access_token"]
