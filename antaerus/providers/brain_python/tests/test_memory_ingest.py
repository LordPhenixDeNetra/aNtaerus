from __future__ import annotations

from antaerus_brain.memory.ingest import extract_facts


def test_extract_facts_returns_heuristic_matches() -> None:
    facts = extract_facts(
        "J'aime le football. Je travaille sur Hopitalia. Je veux finir M1.2 rapidement."
    )

    assert len(facts) >= 3
    assert any(fact.category == "preferences" for fact in facts)
    assert any(fact.category == "projects" for fact in facts)
    assert any(fact.category == "goals" for fact in facts)
