from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from antaerus_brain.config import get_settings
from antaerus_brain.skills import (
    SkillInstallRequest,
    SkillListResponse,
    SkillRecord,
    SkillRunResult,
    SkillRuntime,
    SkillStatus,
    SkillUpdateRequest,
)
from antaerus_brain.skills.lifecycle import SkillLifecycleManager
from antaerus_brain.skills.registry import SkillRegistry, create_skill_registry

router = APIRouter(prefix="/skills", tags=["skills"])

_registry: SkillRegistry | None = None
_lifecycle: SkillLifecycleManager | None = None


def _registry_singleton() -> SkillRegistry:
    global _registry
    if _registry is None:
        settings = get_settings()
        _registry = create_skill_registry(settings.skills_db_path)
    return _registry


def _lifecycle_singleton() -> SkillLifecycleManager:
    global _lifecycle
    if _lifecycle is None:
        settings = get_settings()
        _lifecycle = SkillLifecycleManager(
            _registry_singleton(),
            skills_root=settings.skills_root,
        )
    return _lifecycle


class _DecideRequest(BaseModel):
    approve: bool
    by: str | None = None
    reason: str = ""


class _RunSkillRequest(BaseModel):
    model_config = {"populate_by_name": True}

    args_json: str = Field(default="{}", alias="argsJson")
    timeout_ms: int = Field(default=30_000, alias="timeoutMs", ge=1_000, le=300_000)
    fuel_limit: int = Field(default=250_000, alias="fuelLimit", ge=1_000, le=10_000_000)


class _InitSkillsResponse(BaseModel):
    initialized: bool
    dbPath: str


@router.get("/_initialize", response_model=_InitSkillsResponse)
async def initialize_skills_db() -> _InitSkillsResponse:
    registry = _registry_singleton()
    await registry.initialize()
    settings = get_settings()
    return _InitSkillsResponse(initialized=True, dbPath=str(settings.skills_db_path))


@router.get("", response_model=SkillListResponse)
async def list_skills(
    category: Optional[str] = Query(default=None),
    runtime: Optional[SkillRuntime] = Query(default=None),
    status: Optional[SkillStatus] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> SkillListResponse:
    registry = _registry_singleton()
    await registry.initialize()
    items = await registry.list(
        category=category,
        runtime=runtime,
        status=status,
        search=search,
        limit=limit,
        offset=offset,
    )
    total = await registry.count(
        category=category,
        runtime=runtime,
        status=status,
        search=search,
    )
    return SkillListResponse(items=items, total=total)


@router.get("/{skill_id}", response_model=SkillRecord)
async def get_skill(skill_id: str) -> SkillRecord:
    registry = _registry_singleton()
    await registry.initialize()
    row = await registry.get(skill_id)
    if row is None:
        raise HTTPException(status_code=404, detail="skill not found")
    return row


@router.post("", response_model=SkillRecord, status_code=201)
async def install_skill(req: SkillInstallRequest) -> SkillRecord:
    registry = _registry_singleton()
    await registry.initialize()
    lifecycle = _lifecycle_singleton()
    if req.source_tarball_b64:
        return await lifecycle.install_from_tarball_b64(
            name=req.name,
            version=req.version,
            runtime=req.runtime,
            source_tarball_b64=req.source_tarball_b64,
            description=req.description,
            category=req.category,
            author=req.author,
            trusted=bool(req.trusted),
        )
    return await lifecycle.install_from_source_code(
        name=req.name,
        version=req.version,
        runtime=req.runtime,
        source_code=req.source_code or "",
        description=req.description,
        category=req.category,
        author=req.author,
        trusted=bool(req.trusted),
    )


@router.put("/{skill_id}", response_model=SkillRecord)
async def update_skill(skill_id: str, req: SkillUpdateRequest) -> SkillRecord:
    registry = _registry_singleton()
    await registry.initialize()
    lifecycle = _lifecycle_singleton()
    updated = await lifecycle.update(
        skill_id,
        source_code=req.source_code,
        name=req.name,
        version=req.version,
        description=req.description,
        category=req.category,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="skill not found")
    return updated


@router.delete("/{skill_id}", status_code=204)
async def uninstall_skill(skill_id: str) -> None:
    registry = _registry_singleton()
    await registry.initialize()
    lifecycle = _lifecycle_singleton()
    removed = await lifecycle.uninstall(skill_id)
    if not removed:
        raise HTTPException(status_code=404, detail="skill not found")


@router.post("/{skill_id}/run", response_model=SkillRunResult)
async def run_skill(skill_id: str, req: _RunSkillRequest) -> SkillRunResult:
    from antaerus_brain.skills.docker_sandbox import (
        SandboxUnavailableError,
        run_python_code,
    )

    registry = _registry_singleton()
    await registry.initialize()
    skill = await registry.get(skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="skill not found")
    if skill.status != "installed":
        raise HTTPException(
            status_code=409,
            detail=f"skill status={skill.status}, requis status=installed",
        )
    code = skill.source_code
    args_payload = req.args_json or "{}"
    wrapper = (
        "import json, sys\n"
        f"_args = json.loads({args_payload!r})\n"
        "\n"
        f"{code}\n"
        "\n"
        "if __name__ == '__main__':\n"
        "    try:\n"
        "        import importlib.util as _u\n"
        "        print(json.dumps({'entry': 'direct'}))\n"
        "    except Exception as _e:\n"
        "        print(repr(_e), file=sys.stderr)\n"
    )
    try:
        result = await run_python_code(
            wrapper,
            timeout_s=max(1, req.timeout_ms // 1000),
            memory_mb=256,
            network=False,
        )
    except SandboxUnavailableError as exc:
        return SkillRunResult(
            exitCode=126,
            stderr=str(exc),
            durationMs=0,
            sandboxKind="unavailable",
            error="sandbox indisponible",
        )
    return SkillRunResult(
        exitCode=result.exit_code,
        stdout=result.stdout,
        stderr=result.stderr,
        durationMs=result.duration_ms,
        sandboxKind=result.sandbox_kind,
    )


@router.post("/{skill_id}/approve", response_model=SkillRecord)
async def approve_skill(skill_id: str, req: _DecideRequest) -> SkillRecord:
    registry = _registry_singleton()
    await registry.initialize()
    updated = await registry.decide(
        skill_id,
        approve=True,
        by=req.by,
        reason=req.reason,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="skill not found")
    return updated


@router.post("/{skill_id}/reject", response_model=SkillRecord)
async def reject_skill(skill_id: str, req: _DecideRequest) -> SkillRecord:
    registry = _registry_singleton()
    await registry.initialize()
    if req.reason and len(req.reason.strip()) < 8:
        raise HTTPException(
            status_code=400,
            detail="motif rejet requiert au moins 8 caracteres",
        )
    updated = await registry.decide(
        skill_id,
        approve=False,
        by=req.by,
        reason=req.reason,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="skill not found")
    return updated
