from __future__ import annotations

import asyncio
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from antaerus_brain.skills import SkillRecord, SkillRuntime, SkillStatus

_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        runtime TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        author TEXT NOT NULL DEFAULT '',
        installed_at TEXT NOT NULL DEFAULT '',
        checksum TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending_approval',
        source_code TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_skills_runtime ON skills(runtime)",
    "CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status)",
    "CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name_version ON skills(name, version)",
]


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sha256_hex(payload: str | bytes) -> str:
    data = payload.encode("utf-8") if isinstance(payload, str) else payload
    return hashlib.sha256(data).hexdigest()


def _row_to_record(row: aiosqlite.Row) -> SkillRecord:
    return SkillRecord.model_validate({
        "id": row["id"],
        "name": row["name"],
        "version": row["version"],
        "description": row["description"] or "",
        "runtime": row["runtime"],
        "category": row["category"] or "general",
        "author": row["author"] or "",
        "installedAt": row["installed_at"] or "",
        "checksum": row["checksum"] or "",
        "status": row["status"],
        "sourceCode": row["source_code"] or "",
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    })


class SkillRegistry:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.database_path) as connection:
            for statement in _SCHEMA_STATEMENTS:
                await connection.execute(statement)
            await connection.commit()

    async def list(
        self,
        *,
        category: str | None = None,
        runtime: SkillRuntime | None = None,
        status: SkillStatus | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[SkillRecord]:
        where_clauses: list[str] = []
        args: list[Any] = []
        if category:
            where_clauses.append("category = ?")
            args.append(category)
        if runtime:
            where_clauses.append("runtime = ?")
            args.append(runtime)
        if status:
            where_clauses.append("status = ?")
            args.append(status)
        if search:
            where_clauses.append("(name LIKE ? OR description LIKE ?)")
            pattern = f"%{search}%"
            args.extend([pattern, pattern])
        sql = "SELECT * FROM skills"
        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)
        sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        args.extend([limit, offset])
        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(sql, args)
            rows = await cursor.fetchall()
        return [_row_to_record(r) for r in rows]

    async def count(
        self,
        *,
        category: str | None = None,
        runtime: SkillRuntime | None = None,
        status: SkillStatus | None = None,
        search: str | None = None,
    ) -> int:
        where_clauses: list[str] = []
        args: list[Any] = []
        if category:
            where_clauses.append("category = ?")
            args.append(category)
        if runtime:
            where_clauses.append("runtime = ?")
            args.append(runtime)
        if status:
            where_clauses.append("status = ?")
            args.append(status)
        if search:
            where_clauses.append("(name LIKE ? OR description LIKE ?)")
            pattern = f"%{search}%"
            args.extend([pattern, pattern])
        sql = "SELECT COUNT(*) AS c FROM skills"
        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)
        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(sql, args)
            row = await cursor.fetchone()
        return int(row["c"]) if row else 0

    async def get(self, skill_id: str) -> SkillRecord | None:
        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                "SELECT * FROM skills WHERE id = ?", (skill_id,)
            )
            row = await cursor.fetchone()
        return _row_to_record(row) if row else None

    async def get_by_name_version(self, name: str, version: str) -> SkillRecord | None:
        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                "SELECT * FROM skills WHERE name = ? AND version = ?", (name, version)
            )
            row = await cursor.fetchone()
        return _row_to_record(row) if row else None

    async def create(
        self,
        *,
        name: str,
        version: str,
        runtime: SkillRuntime,
        description: str = "",
        category: str = "general",
        author: str = "",
        source_code: str = "",
        status: SkillStatus = "pending_approval",
    ) -> SkillRecord:
        async with self._lock:
            skill_id = str(uuid.uuid4())
            ts = _utcnow()
            checksum = _sha256_hex(source_code or f"{name}:{version}:{ts}")
            installed_at = ts if status == "installed" else ""
            async with aiosqlite.connect(self.database_path) as connection:
                await connection.execute(
                    """
                    INSERT INTO skills (
                        id, name, version, description, runtime, category, author,
                        installed_at, checksum, status, source_code, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        skill_id, name, version, description, runtime, category, author,
                        installed_at, checksum, status, source_code, ts, ts,
                    ),
                )
                await connection.commit()
        created = await self.get(skill_id)
        if created is None:
            raise KeyError(f"skill {skill_id} not found after insert")
        return created

    async def patch(self, skill_id: str, **fields: Any) -> SkillRecord | None:
        existing = await self.get(skill_id)
        if existing is None:
            return None
        valid_keys = {
            "name", "version", "description", "runtime", "category", "author",
            "installed_at", "checksum", "status", "source_code",
        }
        update_fields = {k: v for k, v in fields.items() if k in valid_keys and v is not None}
        if not update_fields:
            return existing
        if "source_code" in update_fields:
            update_fields["checksum"] = _sha256_hex(update_fields["source_code"])
        update_fields["updated_at"] = _utcnow()
        if update_fields.get("status") == "installed" and not existing.installed_at:
            update_fields["installed_at"] = update_fields["updated_at"]
        columns = ", ".join(f"{k} = ?" for k in update_fields)
        args = list(update_fields.values())
        args.append(skill_id)
        async with self._lock:
            async with aiosqlite.connect(self.database_path) as connection:
                await connection.execute(
                    f"UPDATE skills SET {columns} WHERE id = ?", args
                )
                await connection.commit()
        return await self.get(skill_id)

    async def delete(self, skill_id: str) -> bool:
        async with self._lock:
            async with aiosqlite.connect(self.database_path) as connection:
                cursor = await connection.execute(
                    "DELETE FROM skills WHERE id = ?", (skill_id,)
                )
                await connection.commit()
        return bool(cursor and cursor.rowcount and cursor.rowcount > 0)

    async def decide(
        self,
        skill_id: str,
        *,
        approve: bool,
        by: str | None = None,
        reason: str = "",
    ) -> SkillRecord | None:
        existing = await self.get(skill_id)
        if existing is None:
            return None
        new_status: SkillStatus = "installed" if approve else "rejected"
        description = existing.description
        if not approve and reason:
            suffix = f" [rejected: {reason}]"
            if by:
                suffix = f" [rejected by {by}: {reason}]"
            description = (description + suffix).strip()
        return await self.patch(skill_id, status=new_status, description=description)


_registry_singleton: SkillRegistry | None = None


def create_skill_registry(database_path: Path) -> SkillRegistry:
    return SkillRegistry(database_path)
