from __future__ import annotations

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS facts (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object TEXT NOT NULL,
        category TEXT NOT NULL,
        confidence REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        source_event_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(source_event_id) REFERENCES events(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS fact_observations (
        id TEXT PRIMARY KEY,
        fact_id TEXT NOT NULL,
        observation TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        confidence REAL NOT NULL,
        FOREIGN KEY(fact_id) REFERENCES facts(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS fact_relations (
        id TEXT PRIMARY KEY,
        fact_id TEXT NOT NULL,
        related_fact_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(fact_id) REFERENCES facts(id),
        FOREIGN KEY(related_fact_id) REFERENCES facts(id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category)",
    "CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts(subject)",
    "CREATE INDEX IF NOT EXISTS idx_facts_text ON facts(subject, predicate, object)",
]
