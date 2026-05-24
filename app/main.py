"""FastAPI application entrypoint.

Wires up Tortoise (via lifespan), the unified error handlers and the API
router. Endpoints/business logic are added in later iterations; routers
never hold business logic (SPEC §5).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from tortoise import Tortoise

from app.config import settings
from app.core.errors import register_exception_handlers
from app.db import TORTOISE_ORM
from app.routers import api_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Schema is owned by Aerich migrations, not generated here.
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        yield
    finally:
        await Tortoise.close_connections()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

register_exception_handlers(app)
app.include_router(api_router)


@app.get("/health", tags=["meta"], summary="Liveness/readiness probe")
async def health() -> dict[str, str]:
    """Healthcheck used by docker compose (SPEC §7.1).

    Verifies the process is up and a DB round-trip succeeds.
    """
    conn = Tortoise.get_connection("default")
    await conn.execute_query("SELECT 1")
    return {"status": "ok"}
