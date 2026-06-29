from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

import aiosqlite

from antaerus_brain.memory import (
    ChatMessageRecord,
    ChatRole,
    ChatSessionRecord,
    FactInput,
    FactRecord,
)
from antaerus_brain.memory.schemas import SCHEMA_STATEMENTS

if TYPE_CHECKING:
    from antaerus_brain.llm import ChatMessage


class MemoryKernel:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path

    async def initialize(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.database_path) as connection:
            for statement in SCHEMA_STATEMENTS:
                await connection.execute(statement)
            await connection.commit()

    async def insert_event(self, content: str, session_id: str | None = None) -> str:
        event_id = str(uuid.uuid4())
        timestamp = _utcnow()

        async with aiosqlite.connect(self.database_path) as connection:
            await connection.execute(
                "INSERT INTO events (id, session_id, content, created_at) VALUES (?, ?, ?, ?)",
                (event_id, session_id, content, timestamp),
            )
            await connection.commit()

        return event_id

    async def ensure_chat_session(
        self,
        session_id: str,
        provider: str | None = None,
    ) -> ChatSessionRecord:
        timestamp = _utcnow()

        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT session_id, provider, created_at, updated_at
                FROM chat_sessions
                WHERE session_id = ?
                """,
                (session_id,),
            )
            existing = await cursor.fetchone()

            if existing:
                next_provider = provider or existing["provider"]
                await connection.execute(
                    """
                    UPDATE chat_sessions
                    SET provider = ?, updated_at = ?
                    WHERE session_id = ?
                    """,
                    (next_provider, timestamp, session_id),
                )
            else:
                await connection.execute(
                    """
                    INSERT INTO chat_sessions (session_id, provider, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (session_id, provider, timestamp, timestamp),
                )
            await connection.commit()

            cursor = await connection.execute(
                """
                SELECT session_id, provider, created_at, updated_at
                FROM chat_sessions
                WHERE session_id = ?
                """,
                (session_id,),
            )
            row = await cursor.fetchone()

        if row is None:
            raise KeyError(f"Session {session_id} not found")

        return _row_to_chat_session(row)

    async def append_chat_message(
        self,
        session_id: str,
        role: ChatRole,
        content: str,
        provider: str | None = None,
    ) -> ChatMessageRecord:
        await self.ensure_chat_session(session_id, provider=provider)
        message_id = str(uuid.uuid4())
        timestamp = _utcnow()

        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            await connection.execute(
                """
                INSERT INTO chat_messages (id, session_id, role, content, provider, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (message_id, session_id, role, content, provider, timestamp),
            )
            await connection.execute(
                """
                UPDATE chat_sessions
                SET updated_at = ?, provider = COALESCE(?, provider)
                WHERE session_id = ?
                """,
                (timestamp, provider, session_id),
            )
            await connection.commit()
            cursor = await connection.execute(
                """
                SELECT id, session_id, role, content, provider, created_at
                FROM chat_messages
                WHERE id = ?
                """,
                (message_id,),
            )
            row = await cursor.fetchone()

        if row is None:
            raise KeyError(f"Chat message {message_id} not found")

        return _row_to_chat_message(row)

    async def list_chat_messages(self, session_id: str) -> list[ChatMessageRecord]:
        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT id, session_id, role, content, provider, created_at
                FROM chat_messages
                WHERE session_id = ?
                ORDER BY created_at ASC
                """,
                (session_id,),
            )
            rows = await cursor.fetchall()

        return [_row_to_chat_message(row) for row in rows]

    async def build_generation_messages(self, session_id: str) -> list["ChatMessage"]:
        from antaerus_brain.llm import ChatMessage

        records = await self.list_chat_messages(session_id)
        return [ChatMessage(role=record.role, content=record.content) for record in records]

    async def upsert_fact(self, fact: FactInput) -> FactRecord:
        fact_id = fact.fact_id or str(uuid.uuid4())
        timestamp = _utcnow()

        async with aiosqlite.connect(self.database_path) as connection:
            cursor = await connection.execute(
                "SELECT id FROM facts WHERE id = ?",
                (fact_id,),
            )
            existing = await cursor.fetchone()
            if existing:
                await connection.execute(
                    """
                    UPDATE facts
                    SET subject = ?, predicate = ?, object = ?, category = ?, confidence = ?,
                        source_event_id = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        fact.subject,
                        fact.predicate,
                        fact.object,
                        fact.category,
                        fact.confidence,
                        fact.source_event_id,
                        timestamp,
                        fact_id,
                    ),
                )
            else:
                await connection.execute(
                    """
                    INSERT INTO facts (
                        id, subject, predicate, object, category, confidence, status,
                        source_event_id, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
                    """,
                    (
                        fact_id,
                        fact.subject,
                        fact.predicate,
                        fact.object,
                        fact.category,
                        fact.confidence,
                        fact.source_event_id,
                        timestamp,
                        timestamp,
                    ),
                )
            await connection.commit()

        return await self.get_fact(fact_id)

    async def get_fact(self, fact_id: str) -> FactRecord:
        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            cursor = await connection.execute(
                """
                SELECT id, subject, predicate, object, category, confidence, status,
                       source_event_id, created_at, updated_at
                FROM facts
                WHERE id = ?
                """,
                (fact_id,),
            )
            row = await cursor.fetchone()
        if row is None:
            raise KeyError(f"Fact {fact_id} not found")

        return _row_to_fact(row)

    async def list_facts(self, query: str | None = None, limit: int = 25) -> list[FactRecord]:
        normalized_limit = max(limit, 1)

        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            if query:
                like_query = f"%{query.lower()}%"
                cursor = await connection.execute(
                    """
                    SELECT id, subject, predicate, object, category, confidence, status,
                           source_event_id, created_at, updated_at
                    FROM facts
                    WHERE lower(subject) LIKE ?
                       OR lower(predicate) LIKE ?
                       OR lower(object) LIKE ?
                       OR lower(category) LIKE ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    (like_query, like_query, like_query, like_query, normalized_limit),
                )
            else:
                cursor = await connection.execute(
                    """
                    SELECT id, subject, predicate, object, category, confidence, status,
                           source_event_id, created_at, updated_at
                    FROM facts
                    ORDER BY updated_at DESC
                    LIMIT ?
                    """,
                    (normalized_limit,),
                )

            rows = await cursor.fetchall()

        return [_row_to_fact(row) for row in rows]

    async def add_observation(self, fact_id: str, observation: str, confidence: float) -> None:
        async with aiosqlite.connect(self.database_path) as connection:
            await connection.execute(
                """
                INSERT INTO fact_observations (id, fact_id, observation, observed_at, confidence)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), fact_id, observation, _utcnow(), confidence),
            )
            await connection.commit()

    async def add_relation(self, fact_id: str, related_fact_id: str, relation_type: str) -> None:
        async with aiosqlite.connect(self.database_path) as connection:
            await connection.execute(
                """
                INSERT INTO fact_relations (id, fact_id, related_fact_id, relation_type, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), fact_id, related_fact_id, relation_type, _utcnow()),
            )
            await connection.commit()


def _row_to_fact(row: aiosqlite.Row) -> FactRecord:
    return FactRecord(
        id=row["id"],
        subject=row["subject"],
        predicate=row["predicate"],
        object=row["object"],
        category=row["category"],
        confidence=row["confidence"],
        source_event_id=row["source_event_id"],
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _row_to_chat_session(row: aiosqlite.Row) -> ChatSessionRecord:
    return ChatSessionRecord(
        session_id=row["session_id"],
        provider=row["provider"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _row_to_chat_message(row: aiosqlite.Row) -> ChatMessageRecord:
    return ChatMessageRecord(
        id=row["id"],
        sessionId=row["session_id"],
        role=row["role"],
        content=row["content"],
        provider=row["provider"],
        createdAt=row["created_at"],
    )


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()
