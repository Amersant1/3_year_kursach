"""API router aggregation.

Concrete routers (auth, assets, transactions, positions, portfolios) are
added in iteration 2. ``api_router`` is included by ``app.main`` now so the
wiring is stable.
"""

from fastapi import APIRouter

api_router = APIRouter()

# Iteration 2 will do, e.g.:
#   from app.routers.auth import router as auth_router
#   api_router.include_router(auth_router)
