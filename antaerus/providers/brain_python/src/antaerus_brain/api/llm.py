from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from antaerus_brain.chat import SessionChatService, SessionStreamRequest
from antaerus_brain.config import get_settings
from antaerus_brain.llm import CompletionResult, GenerationRequest
from antaerus_brain.llm.factory import create_llm_client
from antaerus_brain.llm.streaming import sse_event_stream
from antaerus_brain.memory.kernel import MemoryKernel
from antaerus_brain.prompting import inject_system_prompt

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/providers")
def list_providers() -> dict[str, object]:
    settings = get_settings()
    return {
        "defaultProvider": settings.default_provider,
        "providers": [
            {"name": "anthropic", "model": settings.anthropic_model},
            {"name": "openai", "model": settings.openai_model},
            {"name": "mistral", "model": settings.mistral_model},
            {"name": "deepseek", "model": settings.deepseek_model},
            {"name": "ollama", "model": settings.ollama_model},
        ],
    }


@router.post("/chat", response_model=CompletionResult)
async def chat(request: GenerationRequest) -> CompletionResult:
    settings = get_settings()
    try:
        client = create_llm_client(settings, provider=request.provider)
        return await client.complete(inject_system_prompt(settings, request))
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stream")
async def stream_chat(request: GenerationRequest) -> StreamingResponse:
    settings = get_settings()
    try:
        client = create_llm_client(settings, provider=request.provider)
        stream = sse_event_stream(client, inject_system_prompt(settings, request))
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StreamingResponse(stream, media_type="text/event-stream")


@router.post("/session-stream")
async def stream_session_chat(request: SessionStreamRequest) -> StreamingResponse:
    settings = get_settings()
    service = SessionChatService(settings, MemoryKernel(settings.memory_db_path))
    stream = sse_event_stream(service.stream_session(request))
    return StreamingResponse(stream, media_type="text/event-stream")
