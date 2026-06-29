from __future__ import annotations

import asyncio

from antaerus_brain.memory import FactInput
from antaerus_brain.memory.kernel import MemoryKernel
from antaerus_brain.memory.search import search_facts


def test_search_facts_filters_by_query(tmp_path) -> None:
    async def scenario() -> None:
        kernel = MemoryKernel(tmp_path / "antaerus_memory.db")
        await kernel.initialize()
        await kernel.upsert_fact(
            FactInput(
                subject="user",
                predicate="likes",
                object="Python",
                category="preferences",
                confidence=0.8,
            )
        )
        await kernel.upsert_fact(
            FactInput(
                subject="user",
                predicate="works_on",
                object="Hopitalia",
                category="projects",
                confidence=0.9,
            )
        )

        found = await search_facts(kernel, query="hopitalia", limit=10)
        assert len(found) == 1
        assert found[0].category == "projects"

    asyncio.run(scenario())
