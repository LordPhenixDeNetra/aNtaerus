from __future__ import annotations

from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool
from antaerus_brain.tools.rust_proxy import RustToolProxyError, execute_rust_tool


class CLIToolInput(BaseModel):
    command: str = Field(min_length=1)
    args: list[str] = Field(default_factory=list)
    timeout_seconds: float | None = Field(default=None, gt=0)


class CLITool(BaseTool):
    name = "cli"
    description = "Execute une commande whitelistée sans shell libre"
    risk_level = "high"
    category = "rust-sandbox"
    autonomy_level = 3
    input_model = CLIToolInput
    operations = ("exec",)

    async def _run(self, payload: CLIToolInput):
        try:
            return await execute_rust_tool(
                self.settings,
                tool=self.name,
                endpoint="/internal/tools/cli/execute",
                payload=payload.model_dump(),
            )
        except RustToolProxyError as exc:
            return self.error_result(str(exc))
