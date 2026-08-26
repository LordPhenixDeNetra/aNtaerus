from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

MissionStatus = Literal[
    "draft",
    "planned",
    "pending_approval",
    "running",
    "paused",
    "completed",
    "failed",
    "cancelled",
]


StepStatus = Literal[
    "pending",
    "running",
    "skipped",
    "completed",
    "failed",
    "rolled_back",
]


class StepResult(BaseModel):
    step_id: str
    ok: bool
    status: StepStatus
    output: str = ""
    tool_name: Optional[str] = None
    tool_args: Optional[dict[str, Any]] = None
    raw: Optional[dict[str, Any]] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    error: Optional[str] = None


class MissionStep(BaseModel):
    id: str
    index: int
    title: str
    description: str = ""
    tool_name: Optional[str] = None
    tool_args: Optional[dict[str, Any]] = None
    depends_on: list[int] = Field(default_factory=list)
    expected_output: Optional[str] = None
    status: StepStatus = "pending"
    result: Optional[StepResult] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None

    @field_validator("tool_args")
    @classmethod
    def _tool_args_must_be_json_encodable(
        cls, value: Optional[dict[str, Any]]
    ) -> Optional[dict[str, Any]]:
        if value is None:
            return None
        try:
            json.dumps(value, ensure_ascii=False)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"tool_args must be JSON encodable: {exc}") from exc
        return value


class Mission(BaseModel):
    id: str
    session_id: Optional[str] = None
    title: str
    user_request: str
    plan: str = ""
    steps: list[MissionStep] = Field(default_factory=list)
    status: MissionStatus = "draft"
    autonomy_level: int = 0
    budget_tokens: int = 0
    used_tokens: int = 0
    created_at: str = Field(default_factory=lambda: _utcnow())
    updated_at: str = Field(default_factory=lambda: _utcnow())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None

    @model_validator(mode="after")
    def _non_empty_fields(self) -> "Mission":
        if not self.title.strip():
            raise ValueError("Mission title must not be empty")
        if not self.user_request.strip():
            raise ValueError("Mission user_request must not be empty")
        if not (0 <= self.autonomy_level <= 5):
            raise ValueError("Mission autonomy_level must be between 0 and 5")
        if self.budget_tokens < 0:
            raise ValueError("Mission budget_tokens must be >= 0")
        if self.used_tokens < 0:
            raise ValueError("Mission used_tokens must be >= 0")
        return self


class VerificationResult(BaseModel):
    ok: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class IdempotencyKey(BaseModel):
    mission_id: str
    step_id: str
    payload_hash: str
    executed_at: str


class ReflexionReport(BaseModel):
    mission_id: str
    summary: str
    successes: list[str] = Field(default_factory=list)
    failures: list[str] = Field(default_factory=list)
    suggested_fixes: list[str] = Field(default_factory=list)
    facts_to_remember: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    score_quality: float = 0.0
    generated_at: str = Field(default_factory=lambda: _utcnow())


def _utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


MISSION_SCHEMA_STATEMENTS: list[str] = [
    """
    CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        title TEXT NOT NULL,
        user_request TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        autonomy_level INTEGER NOT NULL DEFAULT 0,
        budget_tokens INTEGER NOT NULL DEFAULT 0,
        used_tokens INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        error TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS mission_steps (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        idx INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tool_name TEXT,
        tool_args TEXT,
        depends_on TEXT,
        expected_output TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        result_json TEXT,
        started_at TEXT,
        finished_at TEXT,
        error TEXT,
        UNIQUE (mission_id, idx),
        FOREIGN KEY(mission_id) REFERENCES missions(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS mission_events (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        step_id TEXT,
        kind TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY(mission_id) REFERENCES missions(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS mission_step_idempotency (
        mission_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        executed_at TEXT NOT NULL,
        result_snapshot TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY (mission_id, payload_hash)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_missions_session_status ON missions(session_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_mission_steps_mission_idx ON mission_steps(mission_id, idx)",
    "CREATE INDEX IF NOT EXISTS idx_mission_events_mission_kind ON mission_events(mission_id, kind)",
    """
    CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'local',
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (key, user_id)
    )
    """,
]
