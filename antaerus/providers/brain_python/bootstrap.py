from __future__ import annotations

import uvicorn

from antaerus_brain.app import create_app
from antaerus_brain.config import get_settings


def build_app():
    return create_app()


def main() -> None:
    settings = get_settings()
    uvicorn.run(build_app(), host="0.0.0.0", port=settings.port, reload=False)


if __name__ == "__main__":
    main()
