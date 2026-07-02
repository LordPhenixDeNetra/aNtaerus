from __future__ import annotations

import asyncio
import sys

from antaerus_brain.config import get_settings
from antaerus_brain.tools.cli import CLITool


def test_cli_tool_executes_whitelisted_command(monkeypatch) -> None:
    get_settings.cache_clear()
    tool = CLITool(get_settings(), {"enabled": True, "allowed_commands": ["python"]})

    result = asyncio.run(
        tool.execute({"command": sys.executable, "args": ["-c", "print('ok-cli')"]})
    )

    assert result.ok is True
    assert result.result["exitCode"] == 0
    assert "ok-cli" in result.result["stdout"]


def test_cli_tool_denies_non_whitelisted_command(monkeypatch) -> None:
    get_settings.cache_clear()
    tool = CLITool(get_settings(), {"enabled": True, "allowed_commands": ["python"]})

    result = asyncio.run(tool.execute({"command": "git", "args": ["status"]}))

    assert result.ok is False
    assert result.status == "denied"
