"""Application configuration. All config via environment variables (SPEC §5).

See ``.env.example`` for the full list. Nothing here has secret defaults
suitable for production — override JWT_SECRET in real deployments.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- App ---
    app_name: str = "Portfolio Manager API"
    debug: bool = False

    # --- PostgreSQL ---
    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "portfolio"
    postgres_user: str = "portfolio"
    postgres_password: str = "portfolio"

    # --- Redis / Celery ---
    redis_url: str = "redis://redis:6379/0"

    # --- Auth (JWT) ---
    jwt_secret: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # --- Background jobs schedule (seconds) ---
    price_refresh_interval: int = 60 * 15
    snapshot_interval: int = 60 * 60

    @property
    def database_url(self) -> str:
        """asyncpg DSN consumed by Tortoise/Aerich."""
        return (
            f"postgres://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
