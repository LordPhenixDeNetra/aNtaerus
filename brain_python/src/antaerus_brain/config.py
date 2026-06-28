from __future__ import annotations

from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True)
class Settings:
    service_name: str
    version: str
    port: int
    environment: str


def get_settings() -> Settings:
    return Settings(
        service_name="brain_python",
        version=getenv("ANTAERUS_BRAIN_VERSION", "0.1.0"),
        port=int(getenv("ANTAERUS_BRAIN_PORT", "8000")),
        environment=getenv("ANTAERUS_ENV", "development"),
    )
