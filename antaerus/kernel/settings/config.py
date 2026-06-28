from __future__ import annotations

from pydantic import BaseModel, ConfigDict, SecretStr


class FoundationSettings(BaseModel):
    model_config = ConfigDict(frozen=True)

    environment: str = "development"
    api_secret: SecretStr = SecretStr("development-secret")
