"""Celery application (SPEC §4).

Worker and beat run as separate docker compose services off this module.
Task bodies are real stubs in ``app.tasks`` for now — implemented in
iteration 4 — but the schedule is wired so beat starts cleanly.
"""

from celery import Celery

from app.config import settings

celery_app = Celery(
    "portfolio",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.prices", "app.tasks.snapshots"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

celery_app.conf.beat_schedule = {
    "refresh-asset-prices": {
        "task": "app.tasks.prices.refresh_all_prices",
        "schedule": float(settings.price_refresh_interval),
    },
    "capture-portfolio-snapshots": {
        "task": "app.tasks.snapshots.capture_all_snapshots",
        "schedule": float(settings.snapshot_interval),
    },
}
