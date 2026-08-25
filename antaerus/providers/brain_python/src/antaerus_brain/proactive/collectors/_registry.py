from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from antaerus_brain.proactive.collectors.base import (
    BaseCollector,
    CollectorResult,
)
from antaerus_brain.proactive.collectors.calendar import CalendarCollector
from antaerus_brain.proactive.collectors.custom import CustomCollector
from antaerus_brain.proactive.collectors.news import NewsCollector
from antaerus_brain.proactive.collectors.system import SystemCollector
from antaerus_brain.proactive.collectors.weather import WeatherCollector


@dataclass
class CollectorRegistry:
    collectors: dict[str, BaseCollector] = field(default_factory=dict)

    def register(self, collector: BaseCollector) -> None:
        self.collectors[collector.name] = collector

    def list_names(self) -> list[str]:
        return sorted(self.collectors.keys())

    def get(self, name: str) -> BaseCollector | None:
        return self.collectors.get(name)

    async def run(self, name: str) -> CollectorResult:
        collector = self.collectors.get(name)
        if collector is None:
            return CollectorResult(
                collectorName=name,
                success=False,
                error=f"collector '{name}' not found",
            )
        try:
            return await collector.run()
        except Exception as exc:  # noqa: BLE001
            return CollectorResult(
                collectorName=name,
                success=False,
                error=str(exc),
            )

    async def run_all(self) -> list[CollectorResult]:
        results: list[CollectorResult] = []
        for name in self.list_names():
            results.append(await self.run(name))
        return results


def create_collector_registry(
    settings,
    custom_configs: list[dict[str, Any]] | None = None,
) -> CollectorRegistry:
    registry = CollectorRegistry()
    registry.register(WeatherCollector(settings=settings))
    registry.register(NewsCollector(settings=settings))
    registry.register(CalendarCollector(settings=settings))
    registry.register(SystemCollector(settings=settings))
    for cfg in custom_configs or []:
        try:
            registry.register(CustomCollector(settings=settings, config=cfg))
        except Exception:  # noqa: BLE001
            continue
    return registry
