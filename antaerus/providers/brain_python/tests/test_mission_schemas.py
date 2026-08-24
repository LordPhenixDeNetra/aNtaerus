from __future__ import annotations

import json
from pathlib import Path

import aiosqlite
import pytest

from antaerus_brain.mission.schemas import (
    MISSION_SCHEMA_STATEMENTS,
    Mission,
    MissionStep,
    ReflexionReport,
    StepResult,
    VerificationResult,
)


def test_mission_step_tool_args_must_be_json_encodable():
    MissionStep(
        id="s1",
        index=0,
        title="ok",
        tool_args={"x": 1, "list": [1, 2, 3], "nested": {"a": "b"}},
    )

    with pytest.raises(ValueError, match="JSON encodable"):
        MissionStep(
            id="s1",
            index=0,
            title="bad",
            tool_args={"lambda": lambda: None},  # type: ignore[dict-item, arg-type]
        )


def test_mission_validates_basic_constraints():
    Mission(
        id="m1",
        session_id="sess1",
        title="M1",
        user_request="Fais quelque chose",
        autonomy_level=3,
    )

    with pytest.raises(ValueError, match="title must not be empty"):
        Mission(id="m2", title="  ", user_request="ok")

    with pytest.raises(ValueError, match="user_request must not be empty"):
        Mission(id="m3", title="t", user_request="")

    with pytest.raises(ValueError, match="autonomy_level must be between"):
        Mission(id="m4", title="t", user_request="r", autonomy_level=9)


def test_verification_result_defaults_ok_true():
    v = VerificationResult(ok=True)
    assert v.errors == []
    assert v.warnings == []


def test_step_result_tolerates_missing_output():
    r = StepResult(step_id="s1", ok=True, status="completed")
    assert r.output == ""


def test_reflexion_report_defaults():
    r = ReflexionReport(mission_id="m1", summary="ok")
    assert r.score_quality == 0.0
    assert r.successes == []
    assert r.facts_to_remember == []


@pytest.mark.asyncio
async def test_schema_creates_all_tables(tmp_path: Path):
    db_path = tmp_path / "m.db"
    async with aiosqlite.connect(db_path) as conn:
        for statement in MISSION_SCHEMA_STATEMENTS:
            await conn.execute(statement)
        await conn.commit()

        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        names = sorted(row[0] for row in await cursor.fetchall())

    assert names == [
        "mission_events",
        "mission_step_idempotency",
        "mission_steps",
        "missions",
    ]


@pytest.mark.asyncio
async def test_primary_keys_unique(tmp_path: Path):
    db_path = tmp_path / "m.db"
    async with aiosqlite.connect(db_path) as conn:
        for statement in MISSION_SCHEMA_STATEMENTS:
            await conn.execute(statement)
        await conn.execute(
            "INSERT INTO missions (id, title, user_request, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("m1", "T", "R", "draft", "2025-01-01T00:00:00", "2025-01-01T00:00:00"),
        )
        with pytest.raises(aiosqlite.IntegrityError):
            await conn.execute(
                "INSERT INTO missions (id, title, user_request, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                ("m1", "T2", "R2", "draft", "2025-01-01T00:00:00", "2025-01-01T00:00:00"),
            )
        await conn.rollback()

        await conn.execute(
            "INSERT INTO missions (id, title, user_request, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("m1", "T", "R", "draft", "2025-01-01T00:00:00", "2025-01-01T00:00:00"),
        )
        await conn.execute(
            "INSERT INTO mission_steps (id, mission_id, idx, title, status) VALUES (?, ?, ?, ?, ?)",
            ("s1", "m1", 0, "step0", "pending"),
        )
        with pytest.raises(aiosqlite.IntegrityError):
            await conn.execute(
                "INSERT INTO mission_steps (id, mission_id, idx, title, status) VALUES (?, ?, ?, ?, ?)",
                ("s1bis", "m1", 0, "step0bis", "pending"),
            )
        await conn.rollback()

        await conn.execute(
            "INSERT INTO mission_step_idempotency (mission_id, step_id, payload_hash, executed_at, result_snapshot) VALUES (?, ?, ?, ?, ?)",
            ("m1", "s1", "h1", "2025-01-01T00:00:00", json.dumps({"x": 1})),
        )
        with pytest.raises(aiosqlite.IntegrityError):
            await conn.execute(
                "INSERT INTO mission_step_idempotency (mission_id, step_id, payload_hash, executed_at, result_snapshot) VALUES (?, ?, ?, ?, ?)",
                ("m1", "s1", "h1", "2025-01-01T00:00:01", json.dumps({"x": 2})),
            )
        await conn.rollback()
