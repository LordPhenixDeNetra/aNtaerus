from __future__ import annotations

from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool
from antaerus_brain.tools.rust_proxy import RustToolProxyError, execute_rust_tool


class FilesystemToolInput(BaseModel):
    path: str = Field(min_length=1)
    encoding: str = "utf-8"
    max_bytes: int | None = Field(default=None, gt=0)


class FilesystemTool(BaseTool):
    name = "filesystem"
    description = "Lit un fichier texte dans une whitelist de chemins autorisés"
    risk_level = "medium"
    category = "rust-sandbox"
    autonomy_level = 3
    input_model = FilesystemToolInput
    operations = ("read",)

    async def _run(self, payload: FilesystemToolInput):
        try:
            return await execute_rust_tool(
                self.settings,
                tool=self.name,
                endpoint="/internal/tools/filesystem/read",
                payload=payload.model_dump(),
            )
        except RustToolProxyError as exc:
            return self.error_result(str(exc))
