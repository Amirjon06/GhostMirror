from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.events import router as events_router
from app.api.health import router as health_router
from app.core.config import settings
from app.db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Local-first developer intelligence API for GhostMirror.",
        lifespan=lifespan,
    )
    app.include_router(health_router)
    app.include_router(events_router)
    return app


app = create_app()
