"""API router aggregation. ``app.main`` mounts ``api_router``."""

from fastapi import APIRouter

from app.routers.assets import router as assets_router
from app.routers.auth import router as auth_router
from app.routers.portfolios import router as portfolios_router
from app.routers.positions import router as positions_router
from app.routers.transactions import router as transactions_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(assets_router)
api_router.include_router(portfolios_router)
api_router.include_router(transactions_router)
api_router.include_router(positions_router)
