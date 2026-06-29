from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from antaerus_brain.config import get_settings
from antaerus_brain.llm import CompletionResult, GenerationRequest
from antaerus_brain.llm.factory import create_llm_client
from antaerus_brain.llm.streaming import sse_event_stream

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
            {"name": "ollama", "model": settings.ollama_model},
        ],
    }


@router.post("/chat", response_model=CompletionResult)
async def chat(request: GenerationRequest) -> CompletionResult:
    settings = get_settings()
    try:
        client = create_llm_client(settings, provider=request.provider)
        return await client.complete(request)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stream")
async def stream_chat(request: GenerationRequest) -> StreamingResponse:
    settings = get_settings()
    try:
        client = create_llm_client(settings, provider=request.provider)
        stream = sse_event_stream(client, request)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StreamingResponse(stream, media_type="text/event-stream")
