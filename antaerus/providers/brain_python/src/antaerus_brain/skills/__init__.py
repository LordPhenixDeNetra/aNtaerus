from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SkillRuntime = Literal["python", "wasm"]
SkillStatus = Literal["installed", "pending_approval", "disabled", "rejected"]


class SkillRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str = Field(min_length=1)
    version: str = Field(min_length=1)
    description: str = ""
    runtime: SkillRuntime
    category: str = "general"
    author: str = ""
    installed_at: str = Field(default="", alias="installedAt")
    checksum: str = ""
    status: SkillStatus = "pending_approval"
    source_code: str = Field(default="", alias="sourceCode")
    created_at: str = Field(default="", alias="createdAt")
    updated_at: str = Field(default="", alias="updatedAt")


class SkillInstallRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1)
    version: str = Field(default="0.1.0", min_length=1)
    description: str = ""
    runtime: SkillRuntime = "python"
    category: str = "general"
    author: str = ""
    source_code: str = Field(default="", alias="sourceCode")
    source_tarball_b64: str | None = Field(default=None, alias="sourceTarballB64")
    trusted: bool = False


class SkillUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    version: str | None = None
    description: str | None = None
    category: str | None = None
    source_code: str | None = Field(default=None, alias="sourceCode")
    status: SkillStatus | None = None


class SkillRunRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    skill_id: str = Field(alias="skillId")
    args_json: str = Field(default="{}", alias="argsJson")
    timeout_ms: int = Field(default=30_000, alias="timeoutMs", ge=1_000, le=300_000)
    fuel_limit: int = Field(default=250_000, alias="fuelLimit", ge=1_000, le=10_000_000)


class SkillRunResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    exit_code: int = Field(alias="exitCode")
    stdout: str = ""
    stderr: str = ""
    duration_ms: int = Field(default=0, alias="durationMs")
    fuel_used: int | None = Field(default=None, alias="fuelUsed")
    sandbox_kind: str = Field(default="local", alias="sandboxKind")
    error: str | None = None


class SkillApprovalDecision(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    approve: bool
    by: str | None = None
    reason: str = ""


class SkillListResponse(BaseModel):
    items: list[SkillRecord]
    total: int


class GeneratedSkillDraft(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str
    runtime: SkillRuntime
    source_code: str = Field(alias="sourceCode")
    category: str = "general"
    suggested_version: str = Field(default="0.1.0", alias="suggestedVersion")
    version: str = Field(default="0.1.0")
    inline_tests: str = Field(default="", alias="inlineTests")

    @property
    def display_version(self) -> str:
        return self.suggested_version or self.version



__all__ = [
    "SkillRuntime",
    "SkillStatus",
    "SkillRecord",
    "SkillInstallRequest",
    "SkillUpdateRequest",
    "SkillRunRequest",
    "SkillRunResult",
    "SkillApprovalDecision",
    "SkillListResponse",
    "GeneratedSkillDraft",
]
