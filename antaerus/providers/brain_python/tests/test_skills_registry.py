import asyncio
import os
from pathlib import Path

import pytest

from antaerus_brain.skills.registry import SkillRegistry


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def _new_registry(tmp_path) -> SkillRegistry:
    db = Path(tmp_path) / f"skills-test-{os.getpid()}-{id(tmp_path)}.db"
    reg = SkillRegistry(db)
    _run(reg.initialize())
    return reg


def test_registry_creates_skill(tmp_path):
    registry = _new_registry(tmp_path)
    created = _run(registry.create(
        name="echo",
        version="0.1.0",
        description="echo test",
        runtime="python",
        category="general",
        author="pytest",
        source_code='def main(args): return {"ok": True}',
        status="installed",
    ))
    assert created.id is not None
    assert created.name == "echo"
    assert created.status == "installed"


def test_registry_unique_name_version(tmp_path):
    registry = _new_registry(tmp_path)
    _run(registry.create(
        name="echo",
        version="0.1.0",
        description="echo",
        runtime="python",
        category="general",
        author="pytest",
        source_code='def main(args): return {}',
        status="installed",
    ))
    with pytest.raises(Exception):
        _run(registry.create(
            name="echo",
            version="0.1.0",
            description="dup",
            runtime="python",
            category="general",
            author="pytest",
            source_code='def main(args): return {}',
            status="installed",
        ))


def test_registry_list_and_count(tmp_path):
    registry = _new_registry(tmp_path)
    for i in range(3):
        _run(registry.create(
            name=f"skill-{i}",
            version="0.1.0",
            description="",
            runtime="python",
            category="general",
            author="",
            source_code="",
            status="installed",
        ))
    assert _run(registry.count()) == 3
    items = _run(registry.list(limit=10, offset=0))
    assert len(items) == 3


def test_registry_get_and_patch(tmp_path):
    registry = _new_registry(tmp_path)
    created = _run(registry.create(
        name="p",
        version="0.1.0",
        description="d",
        runtime="wasm",
        category="system",
        author="",
        source_code="(module)",
        status="pending_approval",
    ))
    fetched = _run(registry.get(created.id))
    assert fetched is not None
    assert fetched.status == "pending_approval"
    updated = _run(registry.patch(created.id, description="new-d"))
    assert updated is not None
    assert updated.description == "new-d"


def test_registry_delete(tmp_path):
    registry = _new_registry(tmp_path)
    created = _run(registry.create(
        name="del",
        version="0.1.0",
        description="",
        runtime="python",
        category="general",
        author="",
        source_code="",
        status="installed",
    ))
    assert _run(registry.delete(created.id)) is True
    assert _run(registry.get(created.id)) is None


def test_registry_decide_approve_and_reject(tmp_path):
    registry = _new_registry(tmp_path)
    pending = _run(registry.create(
        name="need-review",
        version="0.1.0",
        description="",
        runtime="python",
        category="",
        author="",
        source_code="",
        status="pending_approval",
    ))
    approved = _run(registry.decide(pending.id, approve=True))
    assert approved is not None
    assert approved.status == "installed"

    pending2 = _run(registry.create(
        name="need-reject",
        version="0.1.0",
        description="",
        runtime="python",
        category="",
        author="",
        source_code="",
        status="pending_approval",
    ))
    rejected = _run(registry.decide(
        pending2.id, approve=False,
        reason="min 8 chars required here",
    ))
    assert rejected is not None
    assert rejected.status == "rejected"
    assert "min 8 chars required" in rejected.description
