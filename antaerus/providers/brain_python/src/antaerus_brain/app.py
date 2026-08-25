from __future__ import annotations

from fastapi import FastAPI

from antaerus_brain.api.health import router as health_router
from antaerus_brain.api.llm import router as llm_router
from antaerus_brain.api.memory import router as memory_router
from antaerus_brain.api.missions import router as missions_router
from antaerus_brain.api.proactive import router as proactive_router
from antaerus_brain.api.tools import router as tools_router
from antaerus_brain.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="aNtaerus Brain",
        version=settings.version,
        summary="Service Python pour le brain texte et la mémoire aNtaerus",
    )
    app.include_router(health_router)
    app.include_router(llm_router)
    app.include_router(memory_router)
    app.include_router(tools_router)
    app.include_router(missions_router)
    if getattr(settings, "proactive_enabled", True):
        app.include_router(proactive_router)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(create_app(), host="0.0.0.0", port=settings.port, reload=False)


if __name__ == "__main__":
    main()
