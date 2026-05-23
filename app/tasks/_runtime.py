"""Run async (Tortoise) code from within a synchronous Celery task.

The worker process has no FastAPI lifespan, so each task initializes and tears
down its own Tortoise connection. A fresh event loop per invocation keeps
periodic tasks isolated.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

from tortoise import Tortoise

from app.db import TORTOISE_ORM

T = TypeVar("T")


def run_async(make_coro: Callable[[], Awaitable[T]]) -> T:
    async def _runner() -> T:
        await Tortoise.init(config=TORTOISE_ORM)
        try:
            return await make_coro()
        finally:
            await Tortoise.close_connections()

    return asyncio.run(_runner())
