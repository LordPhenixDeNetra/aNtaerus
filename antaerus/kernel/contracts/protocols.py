from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .contracts import ServiceCapabilities, ServiceHealth, SystemStatus


class HealthReader(Protocol):
    def read_health(self) -> ServiceHealth: ...


class CapabilityReader(Protocol):
    def read_capabilities(self) -> ServiceCapabilities: ...


class SystemAggregator(Protocol):
    def build_system_status(self) -> SystemStatus: ...


@dataclass(frozen=True)
class SystemEvent:
    topic: str
    payload: dict[str, str]


class EventNotifier(Protocol):
    def publish(self, event: SystemEvent) -> None: ...
