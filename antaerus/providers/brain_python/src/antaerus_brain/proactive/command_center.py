from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

InitiativeStatus = Literal[
    "draft",
    "pending",
    "running",
    "paused",
    "completed",
    "failed",
    "cancelled",
    "approved",
    "rejected",
]


class Initiative(BaseModel):
    id: str
    title: str
    description: str | None = None
    status: InitiativeStatus = "draft"
    autonomyLevel: int = Field(default=0, ge=0, le=5)
    budgetTokens: int = Field(default=0, ge=0)
    budgetTokensUsed: int = Field(default=0, ge=0)
    triggerType: str = "manual"
    triggerConfig: dict[str, Any] = Field(default_factory=dict)
    sourceCollector: str | None = None
    alertPayload: dict[str, Any] | None = None
    sessionId: str | None = None
    missionId: str | None = None
    error: str | None = None
    createdAt: str
    updatedAt: str
    ranAt: str | None = None
    completedAt: str | None = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


SCHEMA = """
CREATE TABLE IF NOT EXISTS proactive_initiatives (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    autonomy_level INTEGER NOT NULL DEFAULT 0,
    budget_tokens INTEGER NOT NULL DEFAULT 0,
    budget_tokens_used INTEGER NOT NULL DEFAULT 0,
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    trigger_config_json TEXT NOT NULL DEFAULT '{}',
    source_collector TEXT,
    alert_payload_json TEXT,
    session_id TEXT,
    mission_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    ran_at TEXT,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_proactive_initiatives_status
    ON proactive_initiatives(status);
CREATE INDEX IF NOT EXISTS idx_proactive_initiatives_created_at
    ON proactive_initiatives(created_at);
"""


class InitiativeStore:
    def __init__(self, db_path: Path | str):
        self.db_path = str(db_path)
        self._init_schema()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._conn() as conn:
            conn.executescript(SCHEMA)
            conn.commit()

    def _row_to_model(self, row: sqlite3.Row) -> Initiative:
        return Initiative(
            id=row["id"],
            title=row["title"],
            description=row["description"],
            status=row["status"],
            autonomyLevel=row["autonomy_level"],
            budgetTokens=row["budget_tokens"],
            budgetTokensUsed=row["budget_tokens_used"],
            triggerType=row["trigger_type"],
            triggerConfig=json.loads(row["trigger_config_json"] or "{}"),
            sourceCollector=row["source_collector"],
            alertPayload=(
                json.loads(row["alert_payload_json"])
                if row["alert_payload_json"]
                else None
            ),
            sessionId=row["session_id"],
            missionId=row["mission_id"],
            error=row["error"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
            ranAt=row["ran_at"],
            completedAt=row["completed_at"],
        )

    def create(
        self,
        *,
        title: str,
        description: str | None = None,
        status: InitiativeStatus = "draft",
        autonomy_level: int = 0,
        budget_tokens: int = 0,
        trigger_type: str = "manual",
        trigger_config: dict[str, Any] | None = None,
        source_collector: str | None = None,
        alert_payload: dict[str, Any] | None = None,
        session_id: str | None = None,
    ) -> Initiative:
        now = _utc_now_iso()
        initiative_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO proactive_initiatives (
                    id, title, description, status, autonomy_level, budget_tokens,
                    budget_tokens_used, trigger_type, trigger_config_json,
                    source_collector, alert_payload_json, session_id,
                    mission_id, error, created_at, updated_at, ran_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL)
                """,
                (
                    initiative_id,
                    title,
                    description,
                    status,
                    int(autonomy_level),
                    int(budget_tokens),
                    0,
                    trigger_type,
                    json.dumps(trigger_config or {}),
                    source_collector,
                    json.dumps(alert_payload) if alert_payload else None,
                    session_id,
                    now,
                    now,
                ),
            )
            conn.commit()
        return self.get(initiative_id)  # type: ignore[return-value]

    def get(self, initiative_id: str) -> Initiative | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM proactive_initiatives WHERE id = ?",
                (initiative_id,),
            ).fetchone()
        return self._row_to_model(row) if row else None

    def list(
        self,
        *,
        status: Optional[str] = None,
        session_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Initiative]:
        query = "SELECT * FROM proactive_initiatives WHERE 1=1"
        params: list[Any] = []
        if status:
            query += " AND status = ?"
            params.append(status)
        if session_id:
            query += " AND session_id = ?"
            params.append(session_id)
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([int(limit), int(offset)])
        with self._conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [self._row_to_model(r) for r in rows]

    def count(self, *, status: Optional[str] = None, session_id: Optional[str] = None) -> int:
        query = "SELECT COUNT(*) AS c FROM proactive_initiatives WHERE 1=1"
        params: list[Any] = []
        if status:
            query += " AND status = ?"
            params.append(status)
        if session_id:
            query += " AND session_id = ?"
            params.append(session_id)
        with self._conn() as conn:
            row = conn.execute(query, params).fetchone()
        return int(row["c"]) if row else 0

    def patch(self, initiative_id: str, **fields: Any) -> Initiative | None:
        existing = self.get(initiative_id)
        if existing is None:
            return None
        now = _utc_now_iso()
        allowed = {
            "title": "title",
            "description": "description",
            "status": "status",
            "autonomy_level": "autonomyLevel",
            "budget_tokens": "budgetTokens",
            "budget_tokens_used": "budgetTokensUsed",
            "trigger_type": "triggerType",
            "trigger_config": "triggerConfig",
            "source_collector": "sourceCollector",
            "alert_payload": "alertPayload",
            "session_id": "sessionId",
            "mission_id": "missionId",
            "error": "error",
            "ran_at": "ranAt",
            "completed_at": "completedAt",
        }
        set_clauses: list[str] = ["updated_at = ?"]
        params: list[Any] = [now]
        for key, _model_attr in allowed.items():
            if key in fields:
                value = fields[key]
                if key in {"trigger_config", "alert_payload"}:
                    value = json.dumps(value) if value is not None else None
                set_clauses.append(f"{key} = ?")
                params.append(value)
        params.append(initiative_id)
        with self._conn() as conn:
            sql = f"UPDATE proactive_initiatives SET {', '.join(set_clauses)} WHERE id = ?"
            conn.execute(sql, params)
            conn.commit()
        return self.get(initiative_id)


def create_initiative_store(db_path: Path | str) -> InitiativeStore:
    return InitiativeStore(db_path)


@dataclass
class ProactiveRunContext:
    settings: Any
    store: InitiativeStore
