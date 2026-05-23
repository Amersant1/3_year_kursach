"""Portfolio snapshot task (SPEC §4).

For each portfolio, values its open positions in the base currency and appends
a ``PortfolioSnapshot`` timeseries row — the backing store for equity charts.
Runs on the Celery beat schedule.
"""

from app.celery_app import celery_app
from app.tasks._runtime import run_async


@celery_app.task(name="app.tasks.snapshots.capture_all_snapshots")
def capture_all_snapshots() -> dict:
    from app.services import analytics_service

    written = run_async(lambda: analytics_service.capture_snapshots())
    return {"status": "ok", "task": "capture_all_snapshots", "snapshots": written}
