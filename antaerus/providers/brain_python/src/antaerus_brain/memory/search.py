from __future__ import annotations

from antaerus_brain.memory import FactRecord
from antaerus_brain.memory.kernel import MemoryKernel


async def search_facts(kernel: MemoryKernel, query: str | None, limit: int) -> list[FactRecord]:
    return await kernel.list_facts(query=query, limit=limit)
