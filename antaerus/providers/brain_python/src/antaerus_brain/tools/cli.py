from __future__ import annotations

import asyncio
from pathlib import Path

from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool


class CLIToolInput(BaseModel):
    command: str = Field(min_length=1)
    args: list[str] = Field(default_factory=list)
    timeout_seconds: float | None = Field(default=None, gt=0)


class CLITool(BaseTool):
    name = "cli"
    description = "Execute une commande whitelistée sans shell libre"
    risk_level = "high"
    input_model = CLIToolInput
    operations = ("exec",)

    async def _run(self, payload: CLIToolInput):
        normalized_command = _normalize_command_name(payload.command)
        allowed_commands = {
            _normalize_command_name(command)
            for command in self.config.get("allowed_commands", [])
        }
        if not allowed_commands:
            return self.not_configured("cli allowed_commands is empty")
        if normalized_command not in allowed_commands:
            return self.denied(f"command not allowed: {payload.command}")

        timeout_seconds = float(
            payload.timeout_seconds
            or self.config.get("timeout_seconds")
            or self.settings.tool_request_timeout_seconds
        )

        process = await asyncio.create_subprocess_exec(
            payload.command,
            *payload.args,
            cwd=str(self.settings.tools_sandbox_root),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
        except TimeoutError:
            process.kill()
            await process.communicate()
            return self.error_result(
                "command timed out",
                meta={"command": payload.command, "timeoutSeconds": timeout_seconds},
            )

        return self.success(
            {
                "command": payload.command,
                "args": payload.args,
                "exitCode": process.returncode,
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
            }
        )


def _normalize_command_name(command: str) -> str:
    basename = Path(command).name.lower()
    if basename.endswith(".exe"):
        basename = basename[:-4]
    return basename
