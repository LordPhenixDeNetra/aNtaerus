from __future__ import annotations

from pydantic import BaseModel, Field


class FactInput(BaseModel):
    subject: str = Field(min_length=1)
    predicate: str = Field(min_length=1)
    object: str = Field(min_length=1)
    category: str = Field(min_length=1)
    confidence: float = 0.5
    source_event_id: str | None = None
    fact_id: str | None = None


class FactRecord(FactInput):
    id: str
    status: str
    created_at: str
    updated_at: str


class IngestRequest(BaseModel):
    text: str = Field(min_length=1)
    session_id: str | None = None


class MirrorResult(BaseModel):
    generated_files: list[str]


class SearchResponse(BaseModel):
    facts: list[FactRecord]
