from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Literal, TypeAlias

from pydantic import BaseModel, Field

CollectorSeverity: TypeAlias = Literal["info", "warning", "critical"]


class CollectorAlert(BaseModel):
    title: str
    message: str
    severity: CollectorSeverity = "info"
    source: str | None = None
    generatedAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class CollectorBriefing(BaseModel):
    title: str
    summary: str
    generatedAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    metadata: dict[str, Any] = Field(default_factory=dict)


class CollectorResult(BaseModel):
    collectorName: str
    success: bool
    briefing: CollectorBriefing | None = None
    alerts: list[CollectorAlert] = Field(default_factory=list)
    error: str | None = None
    ranAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class BaseCollector(ABC):
    name: str = "base"
    description: str = "collecteur abstrait"

    def __init__(self, settings, config: dict[str, Any] | None = None):
        self.settings = settings
        self.config = config or {}

    @property
    def enabled(self) -> bool:
        return bool(self.config.get("enabled", True))

    async def run(self) -> CollectorResult:
        if not self.enabled:
            return CollectorResult(
                collectorName=self.name,
                success=True,
                briefing=CollectorBriefing(
                    title=f"{self.name} disabled",
                    summary="collecteur desactive dans la config",
                ),
            )
        try:
            return await self._run_internal()
        except Exception as exc:  # noqa: BLE001
            return CollectorResult(
                collectorName=self.name,
                success=False,
                error=str(exc),
            )

    @abstractmethod
    async def _run_internal(self) -> CollectorResult:
        ...
