from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from antaerus_brain.mission.schemas import Mission, MissionStep, StepResult
from antaerus_brain.mission.state import MissionStateStore


@pytest.mark.asyncio
async def test_state_initialize_and_get_mission(tmp_path: Path):
    store = MissionStateStore(tmp_path / "m.db")
    await store.initialize()

    mission = Mission(
        id="m1",
        session_id="s1",
        title="Title",
        user_request="demande",
        plan="le plan",
        steps=[
            MissionStep(id="s0", index=0, title="Etape 0", description="desc 0"),
            MissionStep(id="s1", index=1, title="Etape 1", tool_name="noop", depends_on=[0]),
        ],
        status="planned",
        autonomy_level=1,
    )
    created = await store.create_mission(mission)
    assert created.id == "m1"
    assert len(created.steps) == 2
    assert created.steps[1].depends_on == [0]
    assert created.status == "planned"


@pytest.mark.asyncio
async def test_state_list_missions_filter(tmp_path: Path):
    store = MissionStateStore(tmp_path / "m.db")
    await store.initialize()
    m1 = Mission(id="m1", title="T1", user_request="r", status="completed", session_id="s1")
    m2 = Mission(id="m2", title="T2", user_request="r", status="planned", session_id="s1")
    m3 = Mission(id="m3", title="T3", user_request="r", status="planned", session_id="s2")
    for m in (m1, m2, m3):
        await store.create_mission(m)

    await asyncio.sleep(1.1)
    await store.update_mission_status("m2", "planned")
    all_s1 = await store.list_missions(session_id="s1")
    assert [m.id for m in all_s1] == ["m2", "m1"]
    planned = await store.list_missions(status="planned")
    ids = {m.id for m in planned}
    assert ids == {"m2", "m3"}


@pytest.mark.asyncio
async def test_state_update_status_and_extra(tmp_path: Path):
    store = MissionStateStore(tmp_path / "m.db")
    await store.initialize()
    await store.create_mission(Mission(id="m1", title="T", user_request="r"))
    updated = await store.update_mission_status("m1", "running", started_at="2025-01-01T00:00:00")
    assert updated.status == "running"
    assert updated.started_at == "2025-01-01T00:00:00"


@pytest.mark.asyncio
async def test_state_step_finish_and_fail(tmp_path: Path):
    store = MissionStateStore(tmp_path / "m.db")
    await store.initialize()
    m = Mission(
        id="m1",
        title="T",
        user_request="r",
        steps=[
            MissionStep(id="s0", index=0, title="ok step", tool_name="noop"),
            MissionStep(id="s1", index=1, title="fail step", tool_name="fail"),
        ],
    )
    await store.create_mission(m)
    await store.mark_step_started("m1", "s0")
    loaded = await store.get_mission("m1")
    assert loaded.steps[0].status == "running"

    result = StepResult(
        step_id="s0",
        ok=True,
        status="completed",
        output="bien joue",
        tool_name="noop",
        started_at="2025-01-01T00:00:00",
        finished_at="2025-01-01T00:00:05",
    )
    await store.mark_step_finished("m1", "s0", result)
    await store.mark_step_failed("m1", "s1", error="ca casse")

    mission = await store.get_mission("m1")
    assert mission.steps[0].status == "completed"
    assert mission.steps[0].result is not None
    assert mission.steps[0].result.output == "bien joue"
    assert mission.steps[1].status == "failed"
    assert mission.steps[1].error == "ca casse"


@pytest.mark.asyncio
async def test_state_event_and_idempotency(tmp_path: Path):
    store = MissionStateStore(tmp_path / "m.db")
    await store.initialize()
    await store.create_mission(Mission(id="m1", title="T", user_request="r"))
    event_id = await store.append_event(
        "m1", "progress", {"step": 0, "msg": "cree"}, step_id="s0"
    )
    assert event_id

    events = await store.list_events("m1")
    assert len(events) == 1
    assert events[0]["kind"] == "progress"
    assert events[0]["payload"]["step"] == 0

    await store.record_idempotency("m1", "s0", "hash1", {"ok": True, "x": 1})
    snap = await store.get_idempotency("m1", "s0", "hash1")
    assert snap == {"ok": True, "x": 1}
    assert await store.get_idempotency("m1", "s0", "hash2") is None


@pytest.mark.asyncio
async def test_state_find_interrupted(tmp_path: Path):
    store = MissionStateStore(tmp_path / "m.db")
    await store.initialize()
    m = Mission(
        id="m1",
        title="T",
        user_request="r",
        steps=[
            MissionStep(id="s0", index=0, title="s0"),
            MissionStep(id="s1", index=1, title="s1"),
        ],
    )
    await store.create_mission(m)
    await store.mark_step_started("m1", "s0")
    interrupted = await store.find_interrupted_steps("m1")
    assert [s.id for s in interrupted] == ["s0"]

    result = StepResult(step_id="s0", ok=True, status="completed")
    await store.mark_step_finished("m1", "s0", result)
    assert await store.find_interrupted_steps("m1") == []


@pytest.mark.asyncio
async def test_state_missing_mission_raises(tmp_path: Path):
    store = MissionStateStore(tmp_path / "m.db")
    await store.initialize()
    with pytest.raises(KeyError, match="Mission xxx not found"):
        await store.get_mission("xxx")
