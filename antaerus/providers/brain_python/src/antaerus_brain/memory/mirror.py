from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from antaerus_brain.memory.kernel import MemoryKernel


async def generate_markdown_mirror(kernel: MemoryKernel, target_directory: Path) -> list[Path]:
    target_directory.mkdir(parents=True, exist_ok=True)
    facts = await kernel.list_facts(limit=1000)
    grouped: dict[str, list[str]] = defaultdict(list)

    for fact in facts:
        grouped[fact.category].append(
            f"- `{fact.subject}` {fact.predicate} `{fact.object}` "
            f"(confidence={fact.confidence:.2f}, status={fact.status})"
        )

    generated_files: list[Path] = []
    for category, lines in grouped.items():
        file_path = target_directory / f"{category}.md"
        file_path.write_text(
            "# " + category.title() + "\n\n" + "\n".join(lines) + "\n",
            encoding="utf-8",
        )
        generated_files.append(file_path)

    return generated_files
