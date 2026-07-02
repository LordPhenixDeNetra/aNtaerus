from __future__ import annotations

import asyncio

from antaerus_brain.config import get_settings
from antaerus_brain.tools.base import ToolResult
from antaerus_brain.tools.filesystem import FilesystemTool


def test_filesystem_tool_reads_only_allowed_paths(tmp_path, monkeypatch) -> None:
    async def fake_execute_rust_tool(settings, *, tool, endpoint, payload):
        if payload["path"].startswith("../"):
            return ToolResult(ok=False, tool=tool, status="denied", error="path not allowed")
        return ToolResult(
            ok=True,
            tool=tool,
            status="ok",
            result={
                "path": str(tmp_path / payload["path"]),
                "content": "contenu test",
                "size": 12,
                "truncated": False,
            },
        )

    monkeypatch.setattr(
        "antaerus_brain.tools.filesystem.execute_rust_tool",
        fake_execute_rust_tool,
    )
    get_settings.cache_clear()
    tool = FilesystemTool(get_settings(), {"enabled": True, "allowed_roots": ["allowed"]})

    allowed = asyncio.run(tool.execute({"path": "allowed/note.txt"}))
    denied = asyncio.run(tool.execute({"path": "../forbidden.txt"}))

    assert allowed.ok is True
    assert allowed.result["content"] == "contenu test"
    assert denied.ok is False
    assert denied.status == "denied"
