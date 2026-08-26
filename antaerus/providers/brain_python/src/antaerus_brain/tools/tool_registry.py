from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]
from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool, ToolDescriptor, ToolResult
from antaerus_brain.tools.tool_schema import build_llm_tool_schemas


# ==============================================================================
# PYDANTIC CONFIG CLASSES (ALWAYS FIRST, BEFORE FUNCTIONS USING THEM)
# ==============================================================================


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


# ==============================================================================
# UTILITAIRES (time, paths, env parsing)
# ==============================================================================


def _utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _parse_env_paths(env_str: str) -> list[str]:
    """Parse ANTAERUS_TOOLS_FS_ALLOWED_ROOTS env string.
    Separators (highest priority first):
      * ';;'   -> universal (Windows / macOS / Linux)
      * ';'    -> Windows (C:\\Users\\X\\Musique;D:\\Partages)
      * ':'    -> macOS / Linux (/home/x/Musique:/srv/partages)
    """
    if not env_str:
        return []
    if ";;" in env_str:
        parts = env_str.split(";;")
    elif sys.platform.startswith("win") or (
        ";" in env_str and ":" not in env_str.replace("://", "")
    ):
        parts = env_str.split(";")
    else:
        parts = env_str.split(":")
    cleaned: list[str] = []
    for p in parts:
        p = p.strip().strip('"').strip("'")
        if p and p.lower() != "x" and len(p) > 1:
            cleaned.append(p)
    return cleaned


def _normalize_allowed_root(root: str, sandbox_root: Path) -> str | None:
    try:
        if not root:
            return None
        candidate = Path(os.path.expandvars(os.path.expanduser(root)))
        if not candidate.is_absolute():
            candidate = sandbox_root / candidate
        resolved = candidate.resolve()
        return str(resolved)
    except (OSError, ValueError, RuntimeError):
        return None


def _unique_paths(paths: list[str], sandbox_root: Path) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for entry in paths:
        norm = _normalize_allowed_root(entry, sandbox_root)
        if norm and norm not in seen:
            seen.add(norm)
            out.append(norm)
    return out


def _sandbox_root() -> Path:
    from antaerus_brain.config import get_settings

    return get_settings().engine_tools_sandbox_root


def _overlay_path_for(config_path: Path) -> Path:
    """Overlay lives next to tools.yaml (tools.user.yaml). Rust engine loads this too, so merged
    state is shared between Brain Python + Rust engine."""
    return config_path.with_name("tools.user.yaml")


def _save_overlay_yaml(
    config_path: Path,
    filesystem_allowed_roots: list[str],
) -> None:
    """Best-effort write merged allowed_roots to tools.user.yaml overlay for Rust engine."""
    try:
        overlay_path = _overlay_path_for(config_path)
        overlay_path.parent.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = {
            "filesystem": {
                "allowed_roots": [str(r) for r in filesystem_allowed_roots],
            },
            "meta": {
                "updated_at": _utcnow(),
                "generator": "antaerus_brain",
                "id": str(uuid.uuid4()),
            },
        }
        overlay_path.write_text(
            yaml.safe_dump(payload, allow_unicode=True, sort_keys=True),
            encoding="utf-8",
        )
    except Exception:  # noqa: BLE001 - overlay best-effort
        pass


# ==============================================================================
# LOAD + FUSION 4 NIVEAUX
# ==============================================================================


def _load_yaml_tools(path: Path) -> ToolsConfig:
    if not path.exists():
        return ToolsConfig()
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        return ToolsConfig()
    return ToolsConfig.model_validate(raw)


def _merge_overlay_into(baseline: ToolsConfig, overlay_path: Path) -> ToolsConfig:
    if not overlay_path.exists():
        return baseline
    try:
        overlay_raw = yaml.safe_load(overlay_path.read_text(encoding="utf-8")) or {}
    except Exception:  # noqa: BLE001
        return baseline
    if not isinstance(overlay_raw, dict):
        return baseline
    # Filesystem booleans + allowed_roots
    fs_cfg = overlay_raw.get("filesystem") or {}
    if isinstance(fs_cfg, dict):
        roots = fs_cfg.get("allowed_roots") or []
        if isinstance(roots, list):
            baseline.filesystem.allowed_roots.extend([str(r) for r in roots])
        if isinstance(fs_cfg.get("enabled"), bool):
            baseline.filesystem.enabled = bool(fs_cfg["enabled"])
        if isinstance(fs_cfg.get("max_bytes"), int):
            baseline.filesystem.max_bytes = int(fs_cfg["max_bytes"])
    cli_cfg = overlay_raw.get("cli") or {}
    if isinstance(cli_cfg, dict):
        cmds = cli_cfg.get("allowed_commands") or []
        if isinstance(cmds, list):
            baseline.cli.allowed_commands.extend([str(c) for c in cmds])
        if isinstance(cli_cfg.get("enabled"), bool):
            baseline.cli.enabled = bool(cli_cfg["enabled"])
        if isinstance(cli_cfg.get("timeout_seconds"), (int, float)):
            baseline.cli.timeout_seconds = float(cli_cfg["timeout_seconds"])
    return baseline


def load_tools_config(config_path: Path) -> ToolsConfig:
    """Simple (sync) version — no SQL user_preferences. Used by tool_registry initialization
    when no state_store is available yet.

    Fusion : (1) tools.yaml DEFAULTS → (2) tools.user.yaml overlay → (3) Env var.
    """
    sandbox_root = _sandbox_root()

    baseline = _load_yaml_tools(config_path)
    baseline = _merge_overlay_into(baseline, _overlay_path_for(config_path))
    baseline.filesystem.allowed_roots.extend(
        _parse_env_paths(os.getenv("ANTAERUS_TOOLS_FS_ALLOWED_ROOTS", ""))
    )

    merged = _unique_paths(baseline.filesystem.allowed_roots, sandbox_root)
    baseline.filesystem.allowed_roots = merged
    _save_overlay_yaml(config_path, merged)
    return baseline


async def load_tools_config_async(
    config_path: Path,
    *,
    state_store: Any | None = None,
    user_id: str = "local",
) -> ToolsConfig:
    """Async-aware version — DOES load user_preferences (SQL layer NIV 4 = UI user settings).

    FUSION 4 NIVEAUX (priorité croissante):
       NIV 1. tools.yaml            (devs baseline, push sur Git)
       NIV 2. tools.user.yaml       (overlay généré au run précédent)
       NIV 3. env ANTAERUS_TOOLS_FS_ALLOWED_ROOTS (déploiement / Docker)
       NIV 4. user_preferences SQL  (UI Settings page / utilisateur lambda — LA PLUS FORTE)
    """
    sandbox_root = _sandbox_root()

    baseline = _load_yaml_tools(config_path)
    baseline = _merge_overlay_into(baseline, _overlay_path_for(config_path))
    baseline.filesystem.allowed_roots.extend(
        _parse_env_paths(os.getenv("ANTAERUS_TOOLS_FS_ALLOWED_ROOTS", ""))
    )

    # NIV 4: user_preferences SQL (async SQL query)
    if state_store is not None:
        try:
            pref: Any = await state_store.get_json_pref(
                "tools.filesystem.allowed_roots",
                default=None,
                user_id=user_id,
            )
            if isinstance(pref, list):
                baseline.filesystem.allowed_roots.extend([str(x) for x in pref])
        except Exception:  # noqa: BLE001
            pass

    merged = _unique_paths(baseline.filesystem.allowed_roots, sandbox_root)
    baseline.filesystem.allowed_roots = merged
    _save_overlay_yaml(config_path, merged)
    return baseline


# ==============================================================================
# TOOL REGISTRY (runtime)
# ==============================================================================


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
