from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]
from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool, ToolDescriptor, ToolResult
from antaerus_brain.tools.tool_schema import build_llm_tool_schemas


class ToolEntryConfig(BaseModel):
    enabled: bool = True


class BrowserToolConfig(ToolEntryConfig):
    max_results: int = 5


class WeatherToolConfig(ToolEntryConfig):
    geocoding_enabled: bool = True


class FilesystemToolConfig(ToolEntryConfig):
    allowed_roots: list[str] = Field(default_factory=list)
    max_bytes: int = 65536


class CliToolConfig(ToolEntryConfig):
    allowed_commands: list[str] = Field(default_factory=list)
    timeout_seconds: float | None = None


class GmailToolConfig(ToolEntryConfig):
    allow_send: bool = False


class CalendarToolConfig(ToolEntryConfig):
    allow_create: bool = False


class VisionToolConfig(ToolEntryConfig):
    default_confidence: float = 0.25


class MemoryToolConfig(ToolEntryConfig):
    default_category: str = "notes"


class ToolsConfig(BaseModel):
    browser: BrowserToolConfig = Field(default_factory=BrowserToolConfig)
    gmail: GmailToolConfig = Field(default_factory=GmailToolConfig)
    calendar: CalendarToolConfig = Field(default_factory=CalendarToolConfig)
    weather: WeatherToolConfig = Field(default_factory=WeatherToolConfig)
    vision: VisionToolConfig = Field(default_factory=VisionToolConfig)
    filesystem: FilesystemToolConfig = Field(default_factory=FilesystemToolConfig)
    memory_tool: MemoryToolConfig = Field(default_factory=MemoryToolConfig)
    cli: CliToolConfig = Field(default_factory=CliToolConfig)


def load_tools_config(config_path: Path) -> ToolsConfig:
    if not config_path.exists():
        return ToolsConfig()

    raw_data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    if not isinstance(raw_data, dict):
        return ToolsConfig()
    return ToolsConfig.model_validate(raw_data)


class ToolRegistry:
    def __init__(self, tools: list[BaseTool]) -> None:
        self._tools = {tool.name: tool for tool in tools}

    def list_tools(self) -> list[BaseTool]:
        return list(self._tools.values())

    def describe_tools(self) -> list[ToolDescriptor]:
        return [tool.descriptor() for tool in self.list_tools()]

    def get(self, name: str) -> BaseTool:
        try:
            return self._tools[name]
        except KeyError as exc:
            raise KeyError(f"Unknown tool: {name}") from exc

    async def execute(self, name: str, arguments: dict[str, Any] | None = None) -> ToolResult:
        tool = self.get(name)
        return await tool.execute(arguments or {})

    def llm_schemas(self) -> list[dict[str, Any]]:
        return build_llm_tool_schemas(self.list_tools())


def resolve_allowed_roots(
    sandbox_root: Path,
    allowed_roots: list[str],
) -> list[Path]:
    resolved: list[Path] = []
    for entry in allowed_roots:
        candidate = Path(entry)
        if not candidate.is_absolute():
            candidate = sandbox_root / candidate
        resolved.append(candidate.resolve())
    return resolved
