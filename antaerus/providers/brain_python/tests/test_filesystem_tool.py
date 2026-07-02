from __future__ import annotations

import asyncio

from antaerus_brain.config import get_settings
from antaerus_brain.tools.filesystem import FilesystemTool


def test_filesystem_tool_reads_only_allowed_paths(tmp_path, monkeypatch) -> None:
    allowed_dir = tmp_path / "allowed"
    allowed_dir.mkdir()
    file_path = allowed_dir / "note.txt"
    file_path.write_text("contenu test", encoding="utf-8")

    monkeypatch.setenv("ANTAERUS_BRAIN_TOOLS_SANDBOX_ROOT", str(tmp_path))
    get_settings.cache_clear()
    tool = FilesystemTool(get_settings(), {"enabled": True, "allowed_roots": ["allowed"]})

    allowed = asyncio.run(tool.execute({"path": "allowed/note.txt"}))
    denied = asyncio.run(tool.execute({"path": "../forbidden.txt"}))

    assert allowed.ok is True
    assert allowed.result["content"] == "contenu test"
    assert denied.ok is False
    assert denied.status == "denied"
