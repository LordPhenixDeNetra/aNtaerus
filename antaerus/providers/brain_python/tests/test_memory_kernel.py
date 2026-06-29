from __future__ import annotations

import asyncio

from antaerus_brain.memory import FactInput
from antaerus_brain.memory.kernel import MemoryKernel


def test_memory_kernel_initializes_and_persists_fact(tmp_path) -> None:
    async def scenario() -> None:
        kernel = MemoryKernel(tmp_path / "antaerus_memory.db")
        await kernel.initialize()
        fact = await kernel.upsert_fact(
            FactInput(
                subject="user",
                predicate="likes",
                object="Python",
                category="preferences",
                confidence=0.8,
            )
        )
        found = await kernel.list_facts(query="python", limit=10)

        assert fact.subject == "user"
        assert len(found) == 1
        assert found[0].object == "Python"

    asyncio.run(scenario())


def test_memory_kernel_persists_chat_history_per_session(tmp_path) -> None:
    async def scenario() -> None:
        kernel = MemoryKernel(tmp_path / "antaerus_memory.db")
        await kernel.initialize()
        await kernel.append_chat_message("session-a", "user", "Bonjour")
        await kernel.append_chat_message("session-a", "assistant", "Salut")
        await kernel.append_chat_message("session-b", "user", "Autre session")

        session_a = await kernel.list_chat_messages("session-a")
        session_b = await kernel.list_chat_messages("session-b")

        assert [message.content for message in session_a] == ["Bonjour", "Salut"]
        assert [message.content for message in session_b] == ["Autre session"]

    asyncio.run(scenario())
