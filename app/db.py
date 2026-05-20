"""Single source of Tortoise/Aerich DB configuration.

Both the FastAPI app (``app.main``) and Aerich (``[tool.aerich]`` in
pyproject.toml -> ``app.db.TORTOISE_ORM``) read this one dict, so the
connection config is never duplicated (SPEC §5).
"""

from app.config import settings

# Every module listed here is scanned for models. ``aerich.models`` must be
# present so Aerich can track its own migration history table.
MODELS_MODULES = ["app.models", "aerich.models"]

TORTOISE_ORM = {
    "connections": {"default": settings.database_url},
    "apps": {
        "models": {
            "models": MODELS_MODULES,
            "default_connection": "default",
        }
    },
    "use_tz": True,
    "timezone": "UTC",
}
