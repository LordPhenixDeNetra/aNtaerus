from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from antaerus_brain.proactive.curator import NocturnalCurator, _CuratorDB


def _fake_settings(tmp_path: Path) -> SimpleNamespace:
    return SimpleNamespace(
        memory_db_path=str(tmp_path / "mem.db"),
        mission_max_steps=20,
    )


def test_curator_lock_file_acquired_and_released(tmp_path: Path) -> None:
    settings = _fake_settings(tmp_path)
    curator = NocturnalCurator.create(settings)
    assert curator.lock_path.parent == tmp_path
    assert not curator.lock_path.exists()
    assert curator._acquire_lock() is True
    assert curator.lock_path.exists()
    curator._release_lock()
    assert not curator.lock_path.exists()


def test_curator_lock_prevents_concurrent_runs(tmp_path: Path) -> None:
    settings = _fake_settings(tmp_path)
    c1 = NocturnalCurator.create(settings)
    c2 = NocturnalCurator.create(settings)
    assert c1._acquire_lock() is True
    assert c2._acquire_lock() is False
    c1._release_lock()
    assert c2._acquire_lock() is True
    c2._release_lock()


def test_curator_db_creates_tables(tmp_path: Path) -> None:
    db = _CuratorDB(tmp_path / "c.db")
    with db._conn() as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
    names = {r[0] for r in rows}
    assert "curator_reports" in names
    assert "curator_patches" in names


@pytest.mark.anyio(backend="asyncio")
async def test_curator_run_generates_report_and_patches(tmp_path: Path) -> None:
    settings = _fake_settings(tmp_path)
    curator = NocturnalCurator.create(settings)
    report = await curator.run(tool_names=[])
    assert report.id.startswith(("c", "r")) or len(report.id) > 10
    assert report.durationMs >= 0
    assert report.notes
    fetched = curator.get_report(report.id)
    assert fetched is not None
    assert fetched.id == report.id
    patches = curator.list_patches(report_id=report.id)
    assert isinstance(patches, list)


def test_curator_decide_patch_approve_and_reject(tmp_path: Path) -> None:
    db_path = tmp_path / "p.db"
    db = _CuratorDB(db_path)
    now = "2026-08-24T02:00:00Z"
    report_id = "rep-decide-1"
    patch_id = "pat-1"
    with db._conn() as conn:
        conn.execute(
            "INSERT INTO curator_reports (id, generated_at, duration_ms, notes_json) "
            "VALUES (?, ?, ?, ?)",
            (report_id, now, 10, "[]"),
        )
        conn.execute(
            """
            INSERT INTO curator_patches (
                id, report_id, kind, title, requires_human,
                autonomy_level, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (patch_id, report_id, "adjust", "A", 1, 3, "proposed", now),
        )
        conn.commit()
    curator = NocturnalCurator(
        settings=_fake_settings(tmp_path), db=db, lock_path=tmp_path / ".lck"
    )
    approved = curator.decide_patch(patch_id, approve=True, by="harness")
    assert approved is not None
    assert approved.status == "approved"
    assert approved.decidedBy == "harness"
    rejected = curator.decide_patch(patch_id, approve=False, by="harness")
    assert rejected is not None
    assert rejected.status == "rejected"


def test_list_patches_filters_by_status(tmp_path: Path) -> None:
    db = _CuratorDB(tmp_path / "q.db")
    now = "2026-08-24T02:00:00Z"
    with db._conn() as conn:
        conn.execute(
            "INSERT INTO curator_reports (id, generated_at, duration_ms, notes_json) "
            "VALUES ('r1', ?, 5, '[]')",
            (now,),
        )
        conn.executemany(
            """
            INSERT INTO curator_patches (
                id, report_id, kind, title, requires_human,
                autonomy_level, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("pA", "r1", "t", "A", 1, 2, "proposed", now),
                ("pB", "r1", "t", "B", 1, 2, "approved", now),
                ("pC", "r1", "t", "C", 1, 2, "rejected", now),
            ],
        )
        conn.commit()
    curator = NocturnalCurator(
        settings=_fake_settings(tmp_path), db=db, lock_path=tmp_path / ".lck"
    )
    proposed = curator.list_patches(status="proposed")
    assert len(proposed) == 1
    assert proposed[0].id == "pA"
    all_p = curator.list_patches(report_id="r1")
    assert len(all_p) == 3
