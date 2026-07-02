from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from antaerus_brain.config import Settings

ToolRiskLevel = Literal["low", "medium", "high"]
ToolStatus = Literal["ok", "error", "denied", "not_configured", "not_available"]
ToolCategory = Literal[
    "browser",
    "communication",
    "calendar",
    "knowledge",
    "vision",
    "memory",
    "rust-sandbox",
]


class ToolAvailability(BaseModel):
    enabled: bool
    available: bool
    reason: str | None = None


class ToolDescriptor(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str
    risk_level: ToolRiskLevel = Field(alias="riskLevel")
    category: ToolCategory
    autonomy_level: int = Field(alias="autonomyLevel", ge=1, le=5)
    operations: list[str] = Field(default_factory=list)
    enabled: bool
    available: bool
    reason: str | None = None
    input_schema: dict[str, Any] = Field(alias="inputSchema")


class ToolResult(BaseModel):
    ok: bool
    tool: str
    status: ToolStatus
    result: Any = None
    error: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class ToolExecuteRequest(BaseModel):
    tool: str = Field(min_length=1)
    arguments: dict[str, Any] = Field(default_factory=dict)


class ToolListResponse(BaseModel):
    tools: list[ToolDescriptor]


class ToolExecuteResponse(ToolResult):
    pass


class BaseTool(ABC):
    name: str
    description: str
    risk_level: ToolRiskLevel = "low"
    category: ToolCategory = "knowledge"
    autonomy_level: int = 1
    input_model: type[BaseModel]
    operations: tuple[str, ...] = ()

    def __init__(self, settings: Settings, config: dict[str, Any] | None = None) -> None:
        self.settings = settings
        self.config = config or {}

    def availability(self) -> ToolAvailability:
        if not self.config.get("enabled", True):
            return ToolAvailability(
                enabled=False,
                available=False,
                reason="tool disabled in config",
            )
        return self._availability()

    def descriptor(self) -> ToolDescriptor:
        availability = self.availability()
        return ToolDescriptor(
            name=self.name,
            description=self.description,
            riskLevel=self.risk_level,
            category=self.category,
            autonomyLevel=self.autonomy_level,
            operations=list(self.operations),
            enabled=availability.enabled,
            available=availability.available,
            reason=availability.reason,
            inputSchema=self.input_model.model_json_schema(),
        )

    async def execute(self, arguments: dict[str, Any] | None = None) -> ToolResult:
        availability = self.availability()
        if not availability.enabled:
            return self.denied(availability.reason or "tool disabled")
        if not availability.available:
            status: ToolStatus = "not_available"
            if availability.reason and "config" in availability.reason:
                status = "not_configured"
            return ToolResult(
                ok=False,
                tool=self.name,
                status=status,
                error=availability.reason,
            )

        try:
            payload = self.input_model.model_validate(arguments or {})
        except ValidationError as exc:
            return ToolResult(
                ok=False,
                tool=self.name,
                status="error",
                error="invalid arguments",
                meta={"validation": exc.errors()},
            )

        result = await self._run(payload)
        if isinstance(result, ToolResult):
            return result
        return self.success(result)

    def success(self, result: Any, *, meta: dict[str, Any] | None = None) -> ToolResult:
        return ToolResult(ok=True, tool=self.name, status="ok", result=result, meta=meta or {})

    def denied(self, reason: str) -> ToolResult:
        return ToolResult(ok=False, tool=self.name, status="denied", error=reason)

    def not_configured(self, reason: str) -> ToolResult:
        return ToolResult(ok=False, tool=self.name, status="not_configured", error=reason)

    def not_available(self, reason: str) -> ToolResult:
        return ToolResult(ok=False, tool=self.name, status="not_available", error=reason)

    def error_result(self, message: str, *, meta: dict[str, Any] | None = None) -> ToolResult:
        return ToolResult(
            ok=False,
            tool=self.name,
            status="error",
            error=message,
            meta=meta or {},
        )

    def _availability(self) -> ToolAvailability:
        return ToolAvailability(enabled=True, available=True)

    @abstractmethod
    async def _run(self, payload: Any) -> ToolResult | Any: ...
