from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ServiceHealth:
    name: str
    status: str
    version: str
    port: int
    url: str
    checked_at: str
    details: str = ""


@dataclass(frozen=True)
class ServiceCapabilities:
    name: str
    version: str
    runtime: str
    capabilities: list[str]


@dataclass(frozen=True)
class SystemStatus:
    product: str
    phase: str
    environment: str
    services: list[ServiceHealth]
    capabilities: list[ServiceCapabilities]
