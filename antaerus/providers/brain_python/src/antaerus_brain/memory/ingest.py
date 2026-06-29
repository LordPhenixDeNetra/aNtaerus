from __future__ import annotations

import re

from antaerus_brain.memory import FactInput

PATTERNS: list[tuple[re.Pattern[str], str, str, str]] = [
    (
        re.compile(r"\bj[' ]aime\s+(?P<object>[^.!?\n]+)", re.IGNORECASE),
        "user",
        "likes",
        "preferences",
    ),
    (
        re.compile(r"\bje travaille sur\s+(?P<object>[^.!?\n]+)", re.IGNORECASE),
        "user",
        "works_on",
        "projects",
    ),
    (
        re.compile(r"\bmon projet(?: principal)? est\s+(?P<object>[^.!?\n]+)", re.IGNORECASE),
        "user",
        "project",
        "projects",
    ),
    (
        re.compile(r"\bje veux\s+(?P<object>[^.!?\n]+)", re.IGNORECASE),
        "user",
        "wants",
        "goals",
    ),
    (
        re.compile(r"\bje suis en relation avec\s+(?P<object>[^.!?\n]+)", re.IGNORECASE),
        "user",
        "related_to",
        "relations",
    ),
    (
        re.compile(r"\bma sante est\s+(?P<object>[^.!?\n]+)", re.IGNORECASE),
        "user",
        "health_status",
        "health",
    ),
]


def extract_facts(text: str, source_event_id: str | None = None) -> list[FactInput]:
    facts: list[FactInput] = []

    for pattern, subject, predicate, category in PATTERNS:
        for match in pattern.finditer(text):
            captured = match.group("object").strip(" .!?\n\t")
            if not captured:
                continue

            facts.append(
                FactInput(
                    subject=subject,
                    predicate=predicate,
                    object=captured,
                    category=category,
                    confidence=0.6,
                    source_event_id=source_event_id,
                )
            )

    return facts
