"""Application configuration. All config via environment variables (SPEC §5).

See ``.env.example`` for the full list. Nothing here has secret defaults
suitable for production — override JWT_SECRET in real deployments.
"""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- App ---
    app_name: str = "Portfolio Manager API"
    debug: bool = False
    # CORS allow-list (comma-separated). "*" allows any origin (handy in dev).
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v):
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

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

    # --- Analytics ---
    # Base reporting currency: all values are converted into it for
    # aggregation/metrics (frontend uses RUB).
    base_currency: str = "RUB"
    # Risk-free rate used in Sharpe/Sortino/CAPM (frontend default 7%).
    risk_free_rate: float = 0.07
    # Trading days per year (annualization factor).
    trading_days: int = 252
    # Benchmark symbol the dashboard compares against.
    benchmark_symbol: str = "IMOEX"

    # --- Pricing providers ---
    # Per-request timeout (seconds) for all external price calls — keeps the
    # service responsive and enables graceful degradation (SPEC §3).
    price_http_timeout: float = 8.0
    moex_base_url: str = "https://iss.moex.com/iss"
    coingecko_base_url: str = "https://api.coingecko.com/api/v3"
    yahoo_base_url: str = "https://query1.finance.yahoo.com"
    # How many days of history to backfill when first pricing an asset.
    history_days: int = 365

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
