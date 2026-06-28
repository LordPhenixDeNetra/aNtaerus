from __future__ import annotations

from pydantic import BaseModel, SecretStr


class FoundationSettings(BaseModel):
    environment: str = "development"
    api_secret: SecretStr = SecretStr("development-secret")
