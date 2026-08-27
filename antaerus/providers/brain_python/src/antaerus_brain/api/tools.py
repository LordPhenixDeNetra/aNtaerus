from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from antaerus_brain.config import get_settings
from antaerus_brain.mission.state import MissionStateStore
from antaerus_brain.tools import create_tool_registry
from antaerus_brain.tools.base import ToolExecuteRequest, ToolExecuteResponse, ToolListResponse
from antaerus_brain.tools.tool_registry import (
    ToolsConfig,
    load_tools_config,
    load_tools_config_async,
)

router = APIRouter(prefix="/tools", tags=["tools"])


PREF_KEY_FS_ROOTS = "tools.filesystem.allowed_roots"
DEFAULT_USER_ID = "local"


# ==============================================================================
# Pydantic schemas for new endpoints
# ==============================================================================


class _FilesystemAllowedRootsResponse(BaseModel):
    allowed_roots: list[str] = Field(default_factory=list)
    source: dict[str, int] = Field(
        default_factory=lambda: {"yaml": 0, "overlay": 0, "env": 0, "user_preferences_sql": 0}
    )
    overlay_path: str
    note: str = (
        "allowed_roots = fusion 4 niveaux (priorité croissante): "
        "1) tools.yaml  → 2) tools.user.yaml overlay → 3) env var "
        "ANTAERUS_TOOLS_FS_ALLOWED_ROOTS → 4) user_preferences SQL (page UI Settings)."
    )


class _PutFilesystemAllowedRootsRequest(BaseModel):
    """SET the complete list of allowed_roots stored in user_preferences SQL.
    This is NIV 4 which has the highest priority."""

    allowed_roots: list[str] = Field(default_factory=list)


class _PostFilesystemAllowedRootRequest(BaseModel):
    """ADD a single path. Validation: must exist + be a directory on the server
    filesystem. Returns the new list."""

    path: str = Field(min_length=1, description="Absolute or relative-to-sandbox path to allow")


class _PostFilesystemAllowedRootResponse(BaseModel):
    added: str
    allowed_roots: list[str]
    overlay_written: bool


class _DeleteFilesystemAllowedRootRequest(BaseModel):
    path: str = Field(min_length=1)


class _DeleteFilesystemAllowedRootResponse(BaseModel):
    removed: str
    existed: bool
    allowed_roots: list[str]
    overlay_written: bool


class _ToolsConfigSummaryResponse(BaseModel):
    """Summary of tools.yaml merged state (useful for Settings panel)."""

    tools: ToolListResponse
    filesystem: _FilesystemAllowedRootsResponse
    cli_enabled: bool
    filesystem_enabled: bool
    tools_config_path: str
    overlay_path: str


# ==============================================================================
# Dependencies (MissionStateStore singleton-style per request)
# ==============================================================================


def _state_store() -> MissionStateStore:
    settings = get_settings()
    return MissionStateStore(settings.memory_db_path)


_StateStore = Annotated[MissionStateStore, Depends(_state_store)]


# ==============================================================================
# Helpers
# ==============================================================================


def _resolve_path_existing_dir(path_str: str, sandbox_root: Path) -> str:
    """Normalize + validate path. Raises 422 if not an existing directory."""
    import os

    candidate = Path(os.path.expandvars(os.path.expanduser(path_str)))
    if not candidate.is_absolute():
        candidate = sandbox_root / candidate
    try:
        resolved = candidate.resolve()
    except (OSError, ValueError, RuntimeError) as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Invalid path: {path_str} ({exc})") from exc
    if not resolved.exists():
        raise HTTPException(
            status_code=404, detail=f"Directory not found on server: {resolved}"
        )
    if not resolved.is_dir():
        raise HTTPException(status_code=422, detail=f"Path is not a directory: {resolved}")
    return str(resolved)


def _current_sql_paths(state: MissionStateStore) -> list[str]:
    """Async wrapper around get_json_pref for readability in Depends context.
    Caller MUST `await` this coroutine."""
    raise NotImplementedError  # never called directly; replaced inline below


# ==============================================================================
# Original endpoints (preserved + improved)
# ==============================================================================


@router.get("", response_model=ToolListResponse)
async def list_tools() -> ToolListResponse:
    registry = create_tool_registry(get_settings())
    return ToolListResponse(tools=registry.describe_tools())


@router.post("/execute", response_model=ToolExecuteResponse)
async def execute_tool(payload: ToolExecuteRequest) -> ToolExecuteResponse:
    registry = create_tool_registry(get_settings())
    try:
        result = await registry.execute(payload.tool, payload.arguments)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ToolExecuteResponse.model_validate(result.model_dump())


# ==============================================================================
# NEW endpoints: Tools summary page / Settings
# ==============================================================================


@router.get("/summary", response_model=_ToolsConfigSummaryResponse)
async def tools_summary(state: _StateStore) -> _ToolsConfigSummaryResponse:
    settings = get_settings()
    registry = create_tool_registry(settings)
    tools_response = ToolListResponse(tools=registry.describe_tools())

    cfg: ToolsConfig = await load_tools_config_async(
        settings.tools_config_path, state_store=state, user_id=DEFAULT_USER_ID
    )

    # -- Build source breakdown (approximation counts)
    baseline_paths = set(load_tools_config(settings.tools_config_path).filesystem.allowed_roots)
    sql_paths = await state.get_json_pref(PREF_KEY_FS_ROOTS, default=[], user_id=DEFAULT_USER_ID)
    sql_paths = list(sql_paths) if isinstance(sql_paths, list) else []
    env_paths = ToolsConfig.model_validate(
        {"filesystem": {"allowed_roots": []}}
    ).filesystem.allowed_roots
    import os

    from antaerus_brain.tools.tool_registry import _parse_env_paths

    env_paths = _parse_env_paths(os.getenv("ANTAERUS_TOOLS_FS_ALLOWED_ROOTS", ""))
    overlay_cfg = ToolsConfig.model_validate({})
    overlay_yaml = settings.tools_config_path.with_name("tools.user.yaml")
    if overlay_yaml.exists():
        try:
            import yaml  # type: ignore

            raw = yaml.safe_load(overlay_yaml.read_text(encoding="utf-8")) or {}
            if isinstance(raw, dict) and isinstance(raw.get("filesystem"), dict):
                r = raw["filesystem"].get("allowed_roots") or []
                overlay_cfg.filesystem.allowed_roots = list(r) if isinstance(r, list) else []
        except Exception:  # noqa: BLE001
            pass

    src = {
        "yaml": len(baseline_paths),
        "overlay": len(overlay_cfg.filesystem.allowed_roots),
        "env": len(env_paths),
        "user_preferences_sql": len(sql_paths),
    }

    return _ToolsConfigSummaryResponse(
        tools=tools_response,
        filesystem=_FilesystemAllowedRootsResponse(
            allowed_roots=list(cfg.filesystem.allowed_roots),
            source=src,
            overlay_path=str(overlay_yaml),
        ),
        cli_enabled=cfg.cli.enabled,
        filesystem_enabled=cfg.filesystem.enabled,
        tools_config_path=str(settings.tools_config_path),
        overlay_path=str(overlay_yaml),
    )


# ==============================================================================
# NEW endpoints: filesystem allowed_roots CRUD
# ==============================================================================


@router.get(
    "/filesystem/allowed-roots",
    response_model=_FilesystemAllowedRootsResponse,
    tags=["tools", "filesystem"],
)
async def get_filesystem_allowed_roots(state: _StateStore) -> _FilesystemAllowedRootsResponse:
    settings = get_settings()
    cfg = await load_tools_config_async(
        settings.tools_config_path, state_store=state, user_id=DEFAULT_USER_ID
    )

    baseline_paths = set(load_tools_config(settings.tools_config_path).filesystem.allowed_roots)
    sql_paths = await state.get_json_pref(PREF_KEY_FS_ROOTS, default=[], user_id=DEFAULT_USER_ID)
    sql_paths = list(sql_paths) if isinstance(sql_paths, list) else []
    import os

    from antaerus_brain.tools.tool_registry import _parse_env_paths

    env_paths = _parse_env_paths(os.getenv("ANTAERUS_TOOLS_FS_ALLOWED_ROOTS", ""))

    overlay_yaml = settings.tools_config_path.with_name("tools.user.yaml")
    overlay_count = 0
    if overlay_yaml.exists():
        try:
            import yaml  # type: ignore

            raw = yaml.safe_load(overlay_yaml.read_text(encoding="utf-8")) or {}
            if isinstance(raw, dict) and isinstance(raw.get("filesystem"), dict):
                r = raw["filesystem"].get("allowed_roots") or []
                overlay_count = len(r) if isinstance(r, list) else 0
        except Exception:  # noqa: BLE001
            overlay_count = 0

    return _FilesystemAllowedRootsResponse(
        allowed_roots=list(cfg.filesystem.allowed_roots),
        source={
            "yaml": len(baseline_paths),
            "overlay": overlay_count,
            "env": len(env_paths),
            "user_preferences_sql": len(sql_paths),
        },
        overlay_path=str(overlay_yaml),
    )


@router.put(
    "/filesystem/allowed-roots",
    response_model=_FilesystemAllowedRootsResponse,
    tags=["tools", "filesystem"],
)
async def put_filesystem_allowed_roots(
    payload: _PutFilesystemAllowedRootsRequest,
    state: _StateStore,
) -> _FilesystemAllowedRootsResponse:
    """SET NIV 4 (SQL user_preferences) = complete list of user-added paths.
    Validates each path exists. Then re-fuses all layers and returns the final merged list."""
    settings = get_settings()
    sandbox_root = settings.tools_sandbox_root

    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in payload.allowed_roots:
        norm = _resolve_path_existing_dir(raw, sandbox_root)
        if norm not in seen:
            seen.add(norm)
            cleaned.append(norm)

    await state.set_json_pref(PREF_KEY_FS_ROOTS, cleaned, user_id=DEFAULT_USER_ID)

    # Re-run fusion so overlay YAML (Rust engine) is refreshed immediately
    cfg = await load_tools_config_async(
        settings.tools_config_path, state_store=state, user_id=DEFAULT_USER_ID
    )
    return _FilesystemAllowedRootsResponse(
        allowed_roots=list(cfg.filesystem.allowed_roots),
        source={
            "yaml": 0,
            "overlay": 0,
            "env": 0,
            "user_preferences_sql": len(cleaned),
        },
        overlay_path=str(settings.tools_config_path.with_name("tools.user.yaml")),
    )


@router.post(
    "/filesystem/allowed-roots",
    response_model=_PostFilesystemAllowedRootResponse,
    tags=["tools", "filesystem"],
)
async def post_filesystem_allowed_root(
    payload: _PostFilesystemAllowedRootRequest,
    state: _StateStore,
) -> _PostFilesystemAllowedRootResponse:
    """ADD a single directory to NIV 4 SQL (user_preferences).
    Validates path + saves to SQL then refreshes overlay for Rust engine."""
    settings = get_settings()
    sandbox_root = settings.tools_sandbox_root
    norm = _resolve_path_existing_dir(payload.path, sandbox_root)

    current = await state.get_json_pref(
        PREF_KEY_FS_ROOTS, default=[], user_id=DEFAULT_USER_ID
    )
    cur_list: list[str]
    if isinstance(current, list):
        cur_list = [str(x) for x in current]
    else:
        cur_list = []
    if norm not in cur_list:
        cur_list.append(norm)
    await state.set_json_pref(PREF_KEY_FS_ROOTS, cur_list, user_id=DEFAULT_USER_ID)

    cfg = await load_tools_config_async(
        settings.tools_config_path, state_store=state, user_id=DEFAULT_USER_ID
    )
    return _PostFilesystemAllowedRootResponse(
        added=norm,
        allowed_roots=list(cfg.filesystem.allowed_roots),
        overlay_written=settings.tools_config_path.with_name("tools.user.yaml").exists(),
    )


@router.delete(
    "/filesystem/allowed-roots",
    response_model=_DeleteFilesystemAllowedRootResponse,
    tags=["tools", "filesystem"],
)
async def delete_filesystem_allowed_root(
    payload: _DeleteFilesystemAllowedRootRequest,
    state: _StateStore,
) -> _DeleteFilesystemAllowedRootResponse:
    """REMOVE a path from user_preferences SQL NIV4. Normalizes + compares."""
    settings = get_settings()
    sandbox_root = settings.tools_sandbox_root
    to_remove = _resolve_path_existing_dir(payload.path, sandbox_root)

    current = await state.get_json_pref(
        PREF_KEY_FS_ROOTS, default=[], user_id=DEFAULT_USER_ID
    )
    cur_list: list[str] = [str(x) for x in current] if isinstance(current, list) else []

    existed = to_remove in cur_list
    if existed:
        cur_list = [x for x in cur_list if x != to_remove]
        await state.set_json_pref(PREF_KEY_FS_ROOTS, cur_list, user_id=DEFAULT_USER_ID)

    cfg = await load_tools_config_async(
        settings.tools_config_path, state_store=state, user_id=DEFAULT_USER_ID
    )
    return _DeleteFilesystemAllowedRootResponse(
        removed=to_remove,
        existed=existed,
        allowed_roots=list(cfg.filesystem.allowed_roots),
        overlay_written=settings.tools_config_path.with_name("tools.user.yaml").exists(),
    )


# ==============================================================================
# NEW query parameter helper (unused but declared for OpenAPI / docs completeness)
# ==============================================================================


@router.get(
    "/filesystem/allowed-roots/validate",
    response_model=dict,
    tags=["tools", "filesystem"],
)
async def validate_filesystem_allowed_root(
    path: Annotated[
        str,
        Query(
            min_length=1,
            description="Absolute or relative path. Returns normalized + exists + is_dir.",
        ),
    ],
) -> dict:
    """Helper endpoint used by UI before POST /filesystem/allowed-roots."""
    settings = get_settings()
    sandbox_root = settings.tools_sandbox_root
    import os

    candidate = Path(os.path.expandvars(os.path.expanduser(path)))
    if not candidate.is_absolute():
        candidate = sandbox_root / candidate
    try:
        resolved = candidate.resolve()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Invalid path: {exc}") from exc
    return {
        "input": path,
        "normalized": str(resolved),
        "exists": resolved.exists(),
        "is_dir": resolved.is_dir() if resolved.exists() else False,
        "readable": os.access(resolved, os.R_OK) if resolved.exists() else False,
    }
