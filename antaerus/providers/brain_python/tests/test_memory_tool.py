from __future__ import annotations

import asyncio

from antaerus_brain.config import get_settings
from antaerus_brain.tools.memory_tool import MemoryTool


def test_memory_tool_writes_structured_fact(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ANTAERUS_BRAIN_MEMORY_DB_PATH", str(tmp_path / "antaerus_memory.db"))
    get_settings.cache_clear()
    tool = MemoryTool(get_settings(), {"enabled": True, "default_category": "notes"})

    result = asyncio.run(
        tool.execute(
            {
                "subject": "user",
                "predicate": "likes",
                "object": "Python",
            }
        )
    )

    assert result.ok is True
    assert result.result["fact"]["subject"] == "user"
    assert result.result["fact"]["category"] == "notes"
