#!/usr/bin/env python3
"""Anti-emoji linter for aNtaerus sources.

Implements CODING_STANDARDS.md REGLE 1.

Usage:
    python scripts/lint/scan_emoji.py                     # scan default repo root
    python scripts/lint/scan_emoji.py /path/to/project    # scan custom folder
    python scripts/lint/scan_emoji.py --strict-markdown   # ALSO ban emojis in .md/.rst

Exit codes:
    0 - OK, no problematic emoji found in SOURCE files.
    1 - At least one SOURCE file contains a banned emoji. Print issues to stderr.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Banned Unicode emoji / pictograms (RÈGLE 1). This list intentionally matches
# the CODING_STANDARDS.md "interdit" set. We deliberately keep arrows
# U+2190..U+21FF (→ ↔ ←) allowed because they only appear in markdown docs
# and are considered technical characters (not pictograms).
# ---------------------------------------------------------------------------
BANNED_RE = re.compile(
    "["
    "\U0001F300-\U0001F5FF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA70-\U0001FAFF"
    "\U0001F004-\U0001F0CF"
    "\u2139"
    "\u2705\u2702\u2728"
    "\u274C\u274E"
    "\u2753\u2754\u2755\u2757"
    "\u2795\u2796\u2797"
    "\u2B50"
    "\u2600-\u26FF"
    "\u2700-\u27BF"
    "\u2122\u00AE\u00A9"
    "]"
)

# Source extensions that are ALWAYS checked (includes .md by default because
# they're committed files; --relaxed-markdown disables them).
SOURCE_EXTS = {
    ".py", ".go", ".ts", ".tsx", ".js", ".jsx", ".rs",
    ".yaml", ".yml", ".toml", ".json", ".css", ".html",
    ".ini", ".cfg", ".proto", ".md", ".rst", ".sh", ".ps1",
}

SKIP_DIRS = {
    "node_modules", ".git", "dist", "bin", "venv", ".venv", "__pycache__",
    "memory_data", "build", "target", ".next", "coverage", ".cache",
    ".idea", ".vscode", "vendor",
}


def _banned_label(ch: str) -> str:
    cp = ord(ch)
    # ATTENTION: Ne jamais utiliser le caractere emoji reel dans ce dict (risque de
    # se faire flagger par le linter lui-meme). On utilise NOM ASCII uniquement.
    known = {
        0x2139: "INFO_SIGN-U2139",
        0x2705: "CHECK_MARK-U2705",
        0x274C: "CROSS_MARK-U274C",
        0x274E: "CROSS_MARK_NEG-U274E",
        0x2753: "BLACK_QMARK-U2753",
        0x2754: "WHITE_QMARK-U2754",
        0x2755: "WHITE_EXCL-U2755",
        0x2757: "HEAVY_EXCL-U2757",
        0x2795: "PLUS-U2795",
        0x2796: "MINUS-U2796",
        0x2797: "DIVIDE-U2797",
        0x2B50: "WHITE_MEDIUM_STAR-U2B50",
        0x2122: "TRADEMARK-U2122",
        0x00AE: "REGISTERED-U00AE",
        0x00A9: "COPYRIGHT-U00A9",
    }
    if cp in known:
        return known[cp]
    return f"U+{cp:04X}"


def walk_files(root: Path, strict_markdown: bool):
    exts = set(SOURCE_EXTS)
    if not strict_markdown:
        exts.difference_update({".md", ".rst"})
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in exts:
                yield Path(dirpath) / fn


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "root",
        nargs="?",
        default=os.environ.get("ANTAERUS_ROOT") or str(Path(__file__).resolve().parents[2]),
        help="Repository root (default: detect from script location).",
    )
    ap.add_argument(
        "--strict-markdown",
        action="store_true",
        help="Treat .md/.rst as source too (ban emojis even in docs).",
    )
    args = ap.parse_args(argv)

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"[scan_emoji] ERROR: root not found: {root}", file=sys.stderr)
        return 2

    issues: list[tuple[Path, int, set[str], str]] = []
    for fp in walk_files(root, strict_markdown=args.strict_markdown):
        try:
            with open(fp, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
        except (OSError, ValueError):
            continue
        for lineno, line in enumerate(lines, start=1):
            matches = list(BANNED_RE.finditer(line))
            if not matches:
                continue
            chars = sorted({m.group() for m in matches})
            # Only keep the first ~160 chars preview to keep logs short.
            preview = line.strip().replace("\r", " ")[:160]
            issues.append((fp, lineno, set(chars), preview))

    if not issues:
        msg_mode = " (strict-markdown: on)" if args.strict_markdown else ""
        print(f"[scan_emoji] OK : 0 emoji interdit dans SOURCE{msg_mode}.")
        return 0

    # Pretty print to stderr with relative paths.
    print("[scan_emoji] FAIL : violations de REGLE 1 (CODING_STANDARDS.md).", file=sys.stderr)
    for fp, lineno, chars, preview in issues:
        try:
            rel = fp.relative_to(root)
        except ValueError:
            rel = fp
        lbls = " ".join(_banned_label(c) for group in chars for c in group)
        print(
            f"  - {rel}:{lineno} :: {lbls} :: {preview!r}",
            file=sys.stderr,
        )

    unique_files = {fp for fp, *_ in issues}
    print(
        f"[scan_emoji] {len(issues)} ligne(s) dans {len(unique_files)} fichier(s).",
        file=sys.stderr,
    )
    print(
        "[scan_emoji] RESOLUTION : remplacer les emojis par du texte standard "
        "(voir CODING_STANDARDS.md tableau 'RemplaDement syntaDtique standard').",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
