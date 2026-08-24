from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import aiosqlite

from antaerus_brain.mission.schemas import (
    MISSION_SCHEMA_STATEMENTS,
    Mission,
    MissionStep,
    StepResult,
)


def _utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _payload_hash(tool_name: Optional[str], tool_args: Optional[dict[str, Any]]) -> str:
    canonical = json.dumps(
        {"tool_name": tool_name, "tool_args": tool_args},
        ensure_ascii=False,
        sort_keys=True,
    )
    import hashlib

    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class MissionStateStore:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    async def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.database_path) as conn:
            for stmt in MISSION_SCHEMA_STATEMENTS:
                await conn.execute(stmt)
            await conn.commit()

    async def create_mission(self, mission: Mission) -> Mission:
        now = _utcnow()
        row = (
            mission.id,
            mission.session_id,
            mission.title,
            mission.user_request,
            mission.plan,
            mission.status,
            mission.autonomy_level,
            mission.budget_tokens,
            mission.used_tokens,
            mission.created_at or now,
            mission.updated_at or now,
            mission.started_at,
            mission.completed_at,
            mission.error,
        )
        async with aiosqlite.connect(self.database_path) as conn:
            await conn.execute(
                """
                INSERT INTO missions (
                    id, session_id, title, user_request, plan, status,
                    autonomy_level, budget_tokens, used_tokens,
                    created_at, updated_at, started_at, completed_at, error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                row,
            )
            for step in mission.steps:
                await self._upsert_step(conn, mission.id, step, commit=False)
            await conn.commit()
        return await self.get_mission(mission.id)

    async def get_mission(self, mission_id: str) -> Mission:
        async with aiosqlite.connect(self.database_path) as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute("SELECT * FROM missions WHERE id = ?", (mission_id,))
            row = await cur.fetchone()
            if row is None:
                raise KeyError(f"Mission {mission_id} not found")
            steps = await self._load_steps(conn, mission_id)
        return _row_to_mission(row, steps)

    async def list_missions(
        self,
        session_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[Mission]:
        query = "SELECT * FROM missions WHERE 1=1"
        args: list[Any] = []
        if session_id is not None:
            query += " AND session_id = ?"
            args.append(session_id)
        if status is not None:
            query += " AND status = ?"
            args.append(status)
        query += " ORDER BY updated_at DESC LIMIT ?"
        args.append(limit)

        async with aiosqlite.connect(self.database_path) as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(query, tuple(args))
            rows = await cur.fetchall()
            out: list[Mission] = []
            for row in rows:
                steps = await self._load_steps(conn, row["id"])
                out.append(_row_to_mission(row, steps))
            return out

    async def update_mission_status(
        self,
        mission_id: str,
        status: str,
        **extra: Any,
    ) -> Mission:
        fields: list[str] = ["status = ?", "updated_at = ?"]
        args: list[Any] = [status, _utcnow()]
        for key, value in extra.items():
            fields.append(f"{key} = ?")
            args.append(value)
        args.append(mission_id)
        async with aiosqlite.connect(self.database_path) as conn:
            await conn.execute(f"UPDATE missions SET {', '.join(fields)} WHERE id = ?", tuple(args))
            await conn.commit()
        return await self.get_mission(mission_id)

    async def upsert_step(self, mission_id: str, step: MissionStep) -> None:
        async with aiosqlite.connect(self.database_path) as conn:
            await self._upsert_step(conn, mission_id, step, commit=True)

    async def mark_step_started(self, mission_id: str, step_id: str) -> None:
        async with aiosqlite.connect(self.database_path) as conn:
            await conn.execute(
                """
                UPDATE mission_steps
                SET status = 'running', started_at = ?
                WHERE id = ? AND mission_id = ?
                """,
                (_utcnow(), step_id, mission_id),
            )
            await conn.execute(
                "UPDATE missions SET updated_at = ? WHERE id = ?",
                (_utcnow(), mission_id),
            )
            await conn.commit()

    async def mark_step_finished(
        self,
        mission_id: str,
        step_id: str,
        result: StepResult,
    ) -> None:
        async with aiosqlite.connect(self.database_path) as conn:
            result_json = json.dumps(result.model_dump(mode="json"), ensure_ascii=False)
            await conn.execute(
                """
                UPDATE mission_steps
                SET status = ?, finished_at = ?, result_json = ?, error = NULL
                WHERE id = ? AND mission_id = ?
                """,
                (result.status, result.finished_at or _utcnow(), result_json, step_id, mission_id),
            )
            await conn.execute(
                "UPDATE missions SET updated_at = ? WHERE id = ?",
                (_utcnow(), mission_id),
            )
            await conn.commit()

    async def mark_step_failed(self, mission_id: str, step_id: str, error: str) -> None:
        async with aiosqlite.connect(self.database_path) as conn:
            await conn.execute(
                """
                UPDATE mission_steps
                SET status = 'failed', finished_at = ?, error = ?
                WHERE id = ? AND mission_id = ?
                """,
                (_utcnow(), error, step_id, mission_id),
            )
            await conn.execute(
                "UPDATE missions SET updated_at = ? WHERE id = ?",
                (_utcnow(), mission_id),
            )
            await conn.commit()

    async def append_event(
        self,
        mission_id: str,
        kind: str,
        payload: dict[str, Any] | str,
        step_id: Optional[str] = None,
    ) -> str:
        event_id = str(uuid.uuid4())
        payload_str = (
            payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
        )
        async with aiosqlite.connect(self.database_path) as conn:
            await conn.execute(
                """
                INSERT INTO mission_events (id, mission_id, step_id, kind, payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (event_id, mission_id, step_id, kind, payload_str, _utcnow()),
            )
            await conn.commit()
        return event_id

    async def list_events(self, mission_id: str) -> list[dict[str, Any]]:
        async with aiosqlite.connect(self.database_path) as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                "SELECT id, mission_id, step_id, kind, payload, created_at FROM mission_events "
                "WHERE mission_id = ? ORDER BY created_at ASC",
                (mission_id,),
            )
            rows = await cur.fetchall()
            out: list[dict[str, Any]] = []
            for row in rows:
                d = dict(row)
                try:
                    d["payload"] = json.loads(d["payload"])
                except (TypeError, ValueError):
                    pass
                out.append(d)
            return out

    async def record_idempotency(
        self,
        mission_id: str,
        step_id: str,
        payload_hash: str,
        result_snapshot: dict[str, Any],
    ) -> None:
        snapshot_json = json.dumps(result_snapshot, ensure_ascii=False, sort_keys=True)
        async with aiosqlite.connect(self.database_path) as conn:
            await conn.execute(
                """
                INSERT OR IGNORE INTO mission_step_idempotency
                (mission_id, step_id, payload_hash, executed_at, result_snapshot)
                VALUES (?, ?, ?, ?, ?)
                """,
                (mission_id, step_id, payload_hash, _utcnow(), snapshot_json),
            )
            await conn.commit()

    async def get_idempotency(
        self, mission_id: str, step_id: str, payload_hash: str
    ) -> Optional[dict[str, Any]]:
        async with aiosqlite.connect(self.database_path) as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                """
                SELECT result_snapshot, step_id FROM mission_step_idempotency
                WHERE mission_id = ? AND payload_hash = ?
                LIMIT 1
                """,
                (mission_id, payload_hash),
            )
            row = await cur.fetchone()
            if row is None:
                return None
            try:
                return json.loads(row["result_snapshot"])
            except (TypeError, ValueError):
                return {}

    async def find_interrupted_steps(self, mission_id: str) -> list[MissionStep]:
        async with aiosqlite.connect(self.database_path) as conn:
            conn.row_factory = aiosqlite.Row
            cur = await conn.execute(
                """
                SELECT * FROM mission_steps
                WHERE mission_id = ? AND status = 'running' AND finished_at IS NULL
                ORDER BY idx ASC
                """,
                (mission_id,),
            )
            rows = await cur.fetchall()
            return [_row_to_step(row) for row in rows]

    async def _upsert_step(
        self,
        conn: aiosqlite.Connection,
        mission_id: str,
        step: MissionStep,
        *,
        commit: bool,
    ) -> None:
        tool_args_json = (
            None if step.tool_args is None else json.dumps(step.tool_args, ensure_ascii=False)
        )
        depends_json = json.dumps(step.depends_on, ensure_ascii=False) if step.depends_on else None
        result_json = (
            None
            if step.result is None
            else json.dumps(step.result.model_dump(mode="json"), ensure_ascii=False)
        )
        row = (
            step.id,
            mission_id,
            step.index,
            step.title,
            step.description,
            step.tool_name,
            tool_args_json,
            depends_json,
            step.expected_output,
            step.status,
            result_json,
            step.started_at,
            step.finished_at,
            step.error,
        )
        await conn.execute(
            """
            INSERT INTO mission_steps (
                id, mission_id, idx, title, description, tool_name, tool_args,
                depends_on, expected_output, status, result_json, started_at,
                finished_at, error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                mission_id=excluded.mission_id,
                idx=excluded.idx,
                title=excluded.title,
                description=excluded.description,
                tool_name=excluded.tool_name,
                tool_args=excluded.tool_args,
                depends_on=excluded.depends_on,
                expected_output=excluded.expected_output,
                status=excluded.status,
                result_json=excluded.result_json,
                started_at=excluded.started_at,
                finished_at=excluded.finished_at,
                error=excluded.error
            """,
            row,
        )
        if commit:
            await conn.commit()

    async def _load_steps(self, conn: aiosqlite.Connection, mission_id: str) -> list[MissionStep]:
        conn.row_factory = aiosqlite.Row
        cur = await conn.execute(
            "SELECT * FROM mission_steps WHERE mission_id = ? ORDER BY idx ASC",
            (mission_id,),
        )
        rows = await cur.fetchall()
        return [_row_to_step(row) for row in rows]


def _row_to_mission(row: Any, steps: list[MissionStep]) -> Mission:
    return Mission(
        id=row["id"],
        session_id=row["session_id"],
        title=row["title"],
        user_request=row["user_request"],
        plan=row["plan"] or "",
        steps=steps,
        status=row["status"],
        autonomy_level=row["autonomy_level"],
        budget_tokens=row["budget_tokens"],
        used_tokens=row["used_tokens"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        started_at=row["started_at"],
        completed_at=row["completed_at"],
        error=row["error"],
    )


def _row_to_step(row: Any) -> MissionStep:
    tool_args: Optional[dict[str, Any]] = None
    if row["tool_args"]:
        try:
            tool_args = json.loads(row["tool_args"])
        except (TypeError, ValueError):
            tool_args = None

    depends_on: list[int] = []
    if row["depends_on"]:
        try:
            depends_on = json.loads(row["depends_on"])
        except (TypeError, ValueError):
            depends_on = []

    result: Optional[StepResult] = None
    if row["result_json"]:
        try:
            data = json.loads(row["result_json"])
            result = StepResult.model_validate(data)
        except (TypeError, ValueError):
            result = None

    return MissionStep(
        id=row["id"],
        index=row["idx"],
        title=row["title"],
        description=row["description"] or "",
        tool_name=row["tool_name"],
        tool_args=tool_args,
        depends_on=list(depends_on or []),
        expected_output=row["expected_output"],
        status=row["status"],
        result=result,
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        error=row["error"],
    )
