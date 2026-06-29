from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from antaerus_brain.config import get_settings

router = APIRouter()


@router.get("/health")
def healthcheck() -> dict[str, object]:
    settings = get_settings()
    return {
        "name": settings.service_name,
        "status": "healthy",
        "version": settings.version,
        "port": settings.port,
        "url": f"http://localhost:{settings.port}",
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "details": "Brain foundation service operational",
    }


@router.get("/internal/capabilities")
def capabilities() -> dict[str, object]:
    settings = get_settings()
    return {
        "name": settings.service_name,
        "version": settings.version,
        "runtime": "python",
        "capabilities": [
            "healthcheck",
            "capability-reporting",
            "llm-routing",
            "llm-streaming-sse",
            "memory-kernel",
            "memory-search",
            "memory-mirror",
        ],
    }
