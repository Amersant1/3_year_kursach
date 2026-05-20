"""Periodic price refresh task (SPEC §4).

Stub for iteration 1 so the worker/beat start cleanly. Real implementation
(pull prices via providers, persist) lands in iteration 4.
"""

from app.celery_app import celery_app


@celery_app.task(name="app.tasks.prices.refresh_all_prices")
def refresh_all_prices() -> dict:
    # TODO(iteration-4): iterate assets, fetch via pricing providers with
    # timeout + graceful degradation, persist latest price.
    return {"status": "noop", "task": "refresh_all_prices"}
