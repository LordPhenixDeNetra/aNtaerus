from __future__ import annotations

from fastapi import APIRouter

from antaerus_brain.chat import SessionChatService
from antaerus_brain.config import get_settings
from antaerus_brain.memory import (
    ChatHistoryResponse,
    FactInput,
    IngestRequest,
    MirrorResult,
    SearchResponse,
)
from antaerus_brain.memory.ingest import extract_facts
from antaerus_brain.memory.kernel import MemoryKernel
from antaerus_brain.memory.mirror import generate_markdown_mirror
from antaerus_brain.memory.search import search_facts

router = APIRouter(prefix="/memory", tags=["memory"])


def _kernel() -> MemoryKernel:
    settings = get_settings()
    return MemoryKernel(settings.memory_db_path)


@router.get("/facts", response_model=SearchResponse)
async def list_facts(query: str | None = None, limit: int | None = None) -> SearchResponse:
    settings = get_settings()
    kernel = _kernel()
    await kernel.initialize()
    facts = await search_facts(kernel, query=query, limit=limit or settings.memory_default_limit)
    return SearchResponse(facts=facts)


@router.post("/facts", response_model=dict[str, object])
async def create_or_update_fact(payload: FactInput) -> dict[str, object]:
    kernel = _kernel()
    await kernel.initialize()
    fact = await kernel.upsert_fact(payload)
    return {"fact": fact.model_dump()}


@router.post("/ingest", response_model=dict[str, object])
async def ingest_memory(payload: IngestRequest) -> dict[str, object]:
    kernel = _kernel()
    await kernel.initialize()
    event_id = await kernel.insert_event(payload.text, session_id=payload.session_id)
    extracted = extract_facts(payload.text, source_event_id=event_id)
    stored = [await kernel.upsert_fact(fact) for fact in extracted]
    return {
        "eventId": event_id,
        "ingestedCount": len(stored),
        "facts": [fact.model_dump() for fact in stored],
    }


@router.post("/mirror", response_model=MirrorResult)
async def mirror_memory() -> MirrorResult:
    settings = get_settings()
    kernel = _kernel()
    await kernel.initialize()
    generated_files = await generate_markdown_mirror(kernel, settings.memory_topics_dir)
    return MirrorResult(generated_files=[str(path) for path in generated_files])


@router.get("/chat/sessions/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_session_history(session_id: str) -> ChatHistoryResponse:
    settings = get_settings()
    service = SessionChatService(settings, MemoryKernel(settings.memory_db_path))
    return await service.get_session_history(session_id)
