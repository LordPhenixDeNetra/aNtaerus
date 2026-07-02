from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool
from antaerus_brain.tools.tool_registry import resolve_allowed_roots


class FilesystemToolInput(BaseModel):
    path: str = Field(min_length=1)
    encoding: str = "utf-8"
    max_bytes: int | None = Field(default=None, gt=0)


class FilesystemTool(BaseTool):
    name = "filesystem"
    description = "Lit un fichier texte dans une whitelist de chemins autorisés"
    risk_level = "medium"
    input_model = FilesystemToolInput
    operations = ("read",)

    async def _run(self, payload: FilesystemToolInput):
        target = Path(payload.path)
        if not target.is_absolute():
            target = self.settings.tools_sandbox_root / target
        target = target.resolve()

        allowed_roots = resolve_allowed_roots(
            self.settings.tools_sandbox_root,
            list(self.config.get("allowed_roots", [])),
        )
        if not allowed_roots:
            return self.not_configured("filesystem allowed_roots is empty")
        if not any(_is_relative_to(target, root) for root in allowed_roots):
            return self.denied(f"path not allowed: {target}")
        if not target.exists() or not target.is_file():
            return self.error_result(f"file not found: {target}")

        max_bytes = int(payload.max_bytes or self.config.get("max_bytes", 65536))
        raw = target.read_bytes()
        sliced = raw[:max_bytes]
        text = sliced.decode(payload.encoding, errors="replace")
        return self.success(
            {
                "path": str(target),
                "content": text,
                "size": len(raw),
                "truncated": len(raw) > len(sliced),
            }
        )


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False
