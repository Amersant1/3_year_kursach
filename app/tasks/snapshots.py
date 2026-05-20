"""Portfolio snapshot task (SPEC §4).

Stub for iteration 1. Real implementation (compute portfolio value, append
a ``PortfolioSnapshot`` timeseries row) lands in iteration 4.
"""

from app.celery_app import celery_app


@celery_app.task(name="app.tasks.snapshots.capture_all_snapshots")
def capture_all_snapshots() -> dict:
    # TODO(iteration-4): for each portfolio compute total value and append
    # a PortfolioSnapshot row (basis for future frontend charts).
    return {"status": "noop", "task": "capture_all_snapshots"}
