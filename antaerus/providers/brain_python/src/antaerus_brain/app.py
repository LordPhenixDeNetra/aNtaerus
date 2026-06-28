from __future__ import annotations

from fastapi import FastAPI

from antaerus_brain.api.health import router as health_router
from antaerus_brain.config import get_settings

settings = get_settings()


def create_app() -> FastAPI:
    app = FastAPI(
        title="aNtaerus Brain",
        version=settings.version,
        summary="Service Python minimal pour la fondation aNtaerus",
    )
    app.include_router(health_router)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run(create_app(), host="0.0.0.0", port=settings.port, reload=False)


if __name__ == "__main__":
    main()
