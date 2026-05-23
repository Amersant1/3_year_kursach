"""Periodic price refresh task (SPEC §4).

Pulls the latest quote + history for every asset via the pricing providers
(timeout + graceful degradation built into each provider) and refreshes the
configured FX pair. Runs on the Celery beat schedule.
"""

from app.celery_app import celery_app
from app.tasks._runtime import run_async


@celery_app.task(name="app.tasks.prices.refresh_all_prices")
def refresh_all_prices() -> dict:
    from app.services import pricing_service

    report = run_async(lambda: pricing_service.refresh_all())
    return {"status": "ok", "task": "refresh_all_prices", **report}
