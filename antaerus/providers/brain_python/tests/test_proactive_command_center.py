from __future__ import annotations

from pathlib import Path

import pytest

from antaerus_brain.proactive.command_center import InitiativeStore


@pytest.fixture
def store(tmp_path: Path) -> InitiativeStore:
    db_path = tmp_path / "proactive.db"
    return InitiativeStore(db_path)


def test_initiative_store_creates_schema(tmp_path: Path) -> None:
    db_path = tmp_path / "p.db"
    InitiativeStore(db_path)
    assert db_path.exists()


def test_create_and_get_initiative(store: InitiativeStore) -> None:
    created = store.create(
        title="Relancer collecteur meteo",
        description="Le collecteur weather est en erreur.",
        trigger_type="manual",
        trigger_config={},
        autonomy_level=2,
        budget_tokens=500,
        source_collector=None,
        alert_payload=None,
    )
    assert created.id
    assert created.title == "Relancer collecteur meteo"
    assert created.status == "draft"
    assert created.budgetTokens == 500
    fetched = store.get(created.id)
    assert fetched is not None
    assert fetched.id == created.id


def test_list_and_count_initiatives_filters(store: InitiativeStore) -> None:
    a = store.create(title="A", trigger_type="manual", autonomy_level=1, budget_tokens=100)
    b = store.create(title="B", trigger_type="schedule", autonomy_level=1, budget_tokens=100)
    store.patch(a.id, status="running")
    all_items = store.list(limit=10, offset=0)
    assert len(all_items) == 2
    assert store.count() == 2
    sched_items = store.list()
    sched_ids = [i.id for i in sched_items if i.triggerType == "schedule"]
    assert sched_ids == [b.id]
    running_items = store.list(status="running")
    assert running_items[0].id == a.id
    assert store.count(status="running") == 1


def test_patch_initiative_updates_fields(store: InitiativeStore) -> None:
    created = store.create(title="X", autonomy_level=1, budget_tokens=100)
    updated = store.patch(
        created.id,
        status="completed",
        budget_tokens_used=42,
        error=None,
        completed_at="2026-08-24T03:00:00Z",
    )
    assert updated is not None
    assert updated.status == "completed"
    assert updated.budgetTokensUsed == 42
    assert updated.completedAt == "2026-08-24T03:00:00Z"


def test_patch_missing_initiative_returns_none(store: InitiativeStore) -> None:
    assert store.patch("does-not-exist", status="running") is None


def test_get_missing_returns_none(store: InitiativeStore) -> None:
    assert store.get("missing-id") is None
