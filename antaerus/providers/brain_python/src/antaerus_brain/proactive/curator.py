from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

CuratorPatchStatus = Literal["proposed", "approved", "rejected", "applied"]


class CuratorPatch(BaseModel):
    id: str
    reportId: str
    kind: str
    title: str
    description: str | None = None
    proposedDiff: dict[str, Any] | None = None
    targetTable: str | None = None
    targetId: str | None = None
    requiresHuman: bool = True
    autonomyLevel: int = Field(default=3, ge=0, le=5)
    status: CuratorPatchStatus = "proposed"
    appliedAt: str | None = None
    decidedAt: str | None = None
    decidedBy: str | None = None
    createdAt: str


class CuratorReport(BaseModel):
    id: str
    generatedAt: str
    durationMs: int
    factsAdded: int = 0
    factsContradictory: int = 0
    unusedSkills: list[str] = Field(default_factory=list)
    unusedTools: list[str] = Field(default_factory=list)
    estimatedSpendTokens: int = 0
    estimatedCostUsd: float = 0.0
    topPatchesCount: int = 0
    notes: list[str] = Field(default_factory=list)
    patches: list[CuratorPatch] = Field(default_factory=list)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


SCHEMA_CURATOR = """
CREATE TABLE IF NOT EXISTS curator_reports (
    id TEXT PRIMARY KEY,
    generated_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    facts_added INTEGER NOT NULL DEFAULT 0,
    facts_contradictory INTEGER NOT NULL DEFAULT 0,
    unused_skills_json TEXT NOT NULL DEFAULT '[]',
    unused_tools_json TEXT NOT NULL DEFAULT '[]',
    estimated_spend_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd REAL NOT NULL DEFAULT 0,
    top_patches_count INTEGER NOT NULL DEFAULT 0,
    notes_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS curator_patches (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    proposed_diff_json TEXT,
    target_table TEXT,
    target_id TEXT,
    requires_human INTEGER NOT NULL DEFAULT 1,
    autonomy_level INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'proposed',
    applied_at TEXT,
    decided_at TEXT,
    decided_by TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_curator_patches_status ON curator_patches(status);
CREATE INDEX IF NOT EXISTS idx_curator_patches_report ON curator_patches(report_id);
"""


class _CuratorDB:
    def __init__(self, db_path: Path | str):
        self.db_path = str(db_path)
        with self._conn() as conn:
            conn.executescript(SCHEMA_CURATOR)
            conn.commit()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn


@dataclass
class NocturnalCurator:
    settings: Any
    db: _CuratorDB
    lock_path: Path

    @classmethod
    def create(cls, settings) -> "NocturnalCurator":
        db_path = settings.memory_db_path
        project_root = Path(str(db_path)).parent
        lock_path = project_root / ".curator_running.lock"
        return cls(settings=settings, db=_CuratorDB(db_path), lock_path=lock_path)

    def _acquire_lock(self) -> bool:
        try:
            self.lock_path.parent.mkdir(parents=True, exist_ok=True)
            with self.lock_path.open("x", encoding="utf-8") as fh:
                fh.write(_utc_now_iso())
            return True
        except FileExistsError:
            return False

    def _release_lock(self) -> None:
        try:
            self.lock_path.unlink()
        except FileNotFoundError:
            pass

    def _row_to_patch(self, row: sqlite3.Row) -> CuratorPatch:
        diff_raw = row["proposed_diff_json"]
        return CuratorPatch(
            id=row["id"],
            reportId=row["report_id"],
            kind=row["kind"],
            title=row["title"],
            description=row["description"],
            proposedDiff=json.loads(diff_raw) if diff_raw else None,
            targetTable=row["target_table"],
            targetId=row["target_id"],
            requiresHuman=bool(row["requires_human"]),
            autonomyLevel=int(row["autonomy_level"]),
            status=row["status"],
            appliedAt=row["applied_at"],
            decidedAt=row["decided_at"],
            decidedBy=row["decided_by"],
            createdAt=row["created_at"],
        )

    def _row_to_report(self, row: sqlite3.Row, patches: list[CuratorPatch]) -> CuratorReport:
        return CuratorReport(
            id=row["id"],
            generatedAt=row["generated_at"],
            durationMs=int(row["duration_ms"]),
            factsAdded=int(row["facts_added"]),
            factsContradictory=int(row["facts_contradictory"]),
            unusedSkills=json.loads(row["unused_skills_json"] or "[]"),
            unusedTools=json.loads(row["unused_tools_json"] or "[]"),
            estimatedSpendTokens=int(row["estimated_spend_tokens"]),
            estimatedCostUsd=float(row["estimated_cost_usd"]),
            topPatchesCount=int(row["top_patches_count"]),
            notes=json.loads(row["notes_json"] or "[]"),
            patches=patches,
        )

    async def run(self, tool_names: Optional[list[str]] = None) -> CuratorReport:
        if not self._acquire_lock():
            raise RuntimeError("curator est deja en cours d'execution (lock)")
        start = datetime.now(timezone.utc)
        report_id = str(uuid.uuid4())
        notes: list[str] = ["Rapport genere par CuratorNocturne en mode simulation"]
        try:
            try:
                tool_stats = await self._inspect_tools(tool_names or [])
            except Exception as exc:  # noqa: BLE001
                tool_stats = {"unused_tools": [], "unused_skills": []}
                notes.append(f"tools inspection skipped: {exc}")
            try:
                memory_stats = await self._inspect_memory()
            except Exception as exc:  # noqa: BLE001
                memory_stats = {"facts_added": 0, "facts_contradictory": 0}
                notes.append(f"memory inspection skipped: {exc}")
            estimated_tokens = int(getattr(self.settings, "mission_max_steps", 20)) * 500
            estimated_cost = round(estimated_tokens * 3.0 / 1_000_000, 4)
            patches: list[CuratorPatch] = self._propose_patches(
                report_id=report_id,
                tool_stats=tool_stats,
                memory_stats=memory_stats,
            )
            created_patches_db: list[CuratorPatch] = []
            duration_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
            with self.db._conn() as conn:
                conn.execute(
                    """
                    INSERT INTO curator_reports (
                        id, generated_at, duration_ms, facts_added, facts_contradictory,
                        unused_skills_json, unused_tools_json, estimated_spend_tokens,
                        estimated_cost_usd, top_patches_count, notes_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        report_id,
                        _utc_now_iso(),
                        duration_ms,
                        int(memory_stats.get("facts_added", 0)),
                        int(memory_stats.get("facts_contradictory", 0)),
                        json.dumps(tool_stats.get("unused_skills", [])),
                        json.dumps(tool_stats.get("unused_tools", [])),
                        estimated_tokens,
                        estimated_cost,
                        len(patches),
                        json.dumps(notes),
                    ),
                )
                for patch in patches:
                    conn.execute(
                        """
                        INSERT INTO curator_patches (
                            id, report_id, kind, title, description, proposed_diff_json,
                            target_table, target_id, requires_human, autonomy_level,
                            status, applied_at, decided_at, decided_by, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
                        """,
                        (
                            patch.id,
                            patch.reportId,
                            patch.kind,
                            patch.title,
                            patch.description,
                            json.dumps(patch.proposedDiff) if patch.proposedDiff else None,
                            patch.targetTable,
                            patch.targetId,
                            1 if patch.requiresHuman else 0,
                            int(patch.autonomyLevel),
                            patch.status,
                            patch.createdAt,
                        ),
                    )
                    created_patches_db.append(
                        self._row_to_patch(
                            conn.execute(
                                "SELECT * FROM curator_patches WHERE id = ?",
                                (patch.id,),
                            ).fetchone(),
                        ),
                    )
                conn.commit()
            return CuratorReport(
                id=report_id,
                generatedAt=_utc_now_iso(),
                durationMs=duration_ms,
                factsAdded=int(memory_stats.get("facts_added", 0)),
                factsContradictory=int(memory_stats.get("facts_contradictory", 0)),
                unusedSkills=list(tool_stats.get("unused_skills", [])),
                unusedTools=list(tool_stats.get("unused_tools", [])),
                estimatedSpendTokens=estimated_tokens,
                estimatedCostUsd=estimated_cost,
                topPatchesCount=len(created_patches_db),
                notes=notes,
                patches=created_patches_db,
            )
        finally:
            self._release_lock()

    async def _inspect_tools(self, _tool_names: list[str]) -> dict[str, Any]:
        return {"unused_skills": [], "unused_tools": []}

    async def _inspect_memory(self) -> dict[str, Any]:
        try:
            from antaerus_brain.memory.kernel import MemoryKernel

            kernel = MemoryKernel(self.settings.memory_db_path)
            try:
                facts = await kernel.list_facts(limit=100000)
                total = len(facts)
            except Exception:  # noqa: BLE001
                total = 0
            return {"facts_added": total, "facts_contradictory": 0}
        except Exception:  # noqa: BLE001
            return {"facts_added": 0, "facts_contradictory": 0}

    def _propose_patches(
        self,
        *,
        report_id: str,
        tool_stats: dict[str, Any],
        memory_stats: dict[str, Any],
    ) -> list[CuratorPatch]:
        now = _utc_now_iso()
        patches: list[CuratorPatch] = []
        unused_tools = list(tool_stats.get("unused_tools", []))
        if len(unused_tools) > 0:
            patches.append(CuratorPatch(
                id=str(uuid.uuid4()),
                reportId=report_id,
                kind="disable_unused_tools",
                title=f"Desactiver {len(unused_tools)} outils inutilises",
                description=f"Outils proposes a la desactivation: {', '.join(unused_tools[:8])}",
                proposedDiff={"disable_tools": unused_tools},
                targetTable="tool_configs",
                requiresHuman=True,
                autonomyLevel=3,
                status="proposed",
                createdAt=now,
            ))
        if memory_stats.get("facts_contradictory", 0) > 0:
            patches.append(CuratorPatch(
                id=str(uuid.uuid4()),
                reportId=report_id,
                kind="resolve_contradictory_facts",
                title=f"Resoudre {memory_stats['facts_contradictory']} faits contradictoires",
                description="Conciliation basee sur confiance et date",
                proposedDiff={"action": "resolve_by_trust_score"},
                targetTable="memory_facts",
                requiresHuman=True,
                autonomyLevel=4,
                status="proposed",
                createdAt=now,
            ))
        return patches

    def latest_report(self) -> CuratorReport | None:
        with self.db._conn() as conn:
            row = conn.execute(
                "SELECT * FROM curator_reports ORDER BY generated_at DESC LIMIT 1",
            ).fetchone()
            if row is None:
                return None
            patch_rows = conn.execute(
                "SELECT * FROM curator_patches WHERE report_id = ? ORDER BY created_at",
                (row["id"],),
            ).fetchall()
        patches = [self._row_to_patch(p) for p in patch_rows]
        return self._row_to_report(row, patches)

    def get_report(self, report_id: str) -> CuratorReport | None:
        with self.db._conn() as conn:
            row = conn.execute(
                "SELECT * FROM curator_reports WHERE id = ?",
                (report_id,),
            ).fetchone()
            if row is None:
                return None
            patch_rows = conn.execute(
                "SELECT * FROM curator_patches WHERE report_id = ? ORDER BY created_at",
                (report_id,),
            ).fetchall()
        patches = [self._row_to_patch(p) for p in patch_rows]
        return self._row_to_report(row, patches)

    def decide_patch(
        self,
        patch_id: str,
        *,
        approve: bool,
        by: str | None = None,
    ) -> CuratorPatch | None:
        with self.db._conn() as conn:
            row = conn.execute(
                "SELECT * FROM curator_patches WHERE id = ?",
                (patch_id,),
            ).fetchone()
            if row is None:
                return None
            status: CuratorPatchStatus = "approved" if approve else "rejected"
            autonomy = int(row["autonomy_level"])
            requires = bool(row["requires_human"])
            if requires and autonomy >= 3 and approve is False:
                pass  # allowed
            update_sql = (
                "UPDATE curator_patches SET status = ?, "
                "decided_at = ?, decided_by = ? WHERE id = ?"
            )
            conn.execute(update_sql, (status, _utc_now_iso(), by, patch_id))
            conn.commit()
            updated = conn.execute(
                "SELECT * FROM curator_patches WHERE id = ?",
                (patch_id,),
            ).fetchone()
        return self._row_to_patch(updated) if updated else None

    def list_patches(
        self,
        *,
        report_id: Optional[str] = None,
        status: Optional[CuratorPatchStatus] = None,
        limit: int = 50,
    ) -> list[CuratorPatch]:
        query = "SELECT * FROM curator_patches WHERE 1=1"
        params: list[Any] = []
        if report_id:
            query += " AND report_id = ?"
            params.append(report_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(int(limit))
        with self.db._conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [self._row_to_patch(r) for r in rows]


def create_curator(settings) -> NocturnalCurator:
    return NocturnalCurator.create(settings)
