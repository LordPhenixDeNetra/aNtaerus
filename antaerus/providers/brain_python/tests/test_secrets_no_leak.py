from __future__ import annotations

import re
from pathlib import Path

SECRET_PATTERNS = [
    re.compile(r"\bsk-[A-Za-z0-9]{8,}\b"),
    re.compile(r"\bntn_[A-Za-z0-9]{8,}\b"),
]
IGNORED_DIRECTORIES = {
    ".git",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "target",
}
TEXT_EXTENSIONS = {
    ".go",
    ".json",
    ".md",
    ".proto",
    ".ps1",
    ".py",
    ".rs",
    ".sh",
    ".toml",
    ".tsx",
    ".ts",
    ".txt",
    ".yaml",
    ".yml",
}


def test_secrets_no_leak() -> None:
    repository_root = Path(__file__).resolve().parents[3]
    leaks: list[str] = []

    for path in repository_root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in IGNORED_DIRECTORIES for part in path.parts):
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue

        content = path.read_text(encoding="utf-8", errors="ignore")

        for pattern in SECRET_PATTERNS:
            for match in pattern.finditer(content):
                leaks.append(f"{path.relative_to(repository_root)}:{match.group(0)}")

    assert not leaks, "Secrets potentiellement fuités détectés:\n" + "\n".join(leaks)
