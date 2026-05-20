from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "assets" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "symbol" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "asset_class" VARCHAR(16) NOT NULL,
    "pricing_provider" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uid_assets_symbol_7ae15e" UNIQUE ("symbol", "asset_class")
);
CREATE INDEX IF NOT EXISTS "idx_assets_symbol_b74a33" ON "assets" ("symbol");
COMMENT ON COLUMN "assets"."asset_class" IS 'STOCK: stock\nSTOCK_RU: stock_ru\nCRYPTO: crypto\nCUSTOM: custom';
COMMENT ON COLUMN "assets"."pricing_provider" IS 'MOEX: moex\nCOINGECKO: coingecko\nYAHOO: yahoo\nCUSTOM: custom\nMANUAL: manual';
COMMENT ON TABLE "assets" IS 'Tradable / holdable instrument linked to a price source (SPEC §2).';
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "hashed_password" VARCHAR(255) NOT NULL,
    "is_active" BOOL NOT NULL DEFAULT True,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_users_email_133a6f" ON "users" ("email");
COMMENT ON TABLE "users" IS 'Application user. Simple JWT auth, no OAuth/SSO (SPEC §2).';
CREATE TABLE IF NOT EXISTS "portfolios" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" INT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "portfolios" IS 'User-defined grouping of positions / transactions (SPEC §2).';
CREATE TABLE IF NOT EXISTS "portfolio_snapshots" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "total_value" DECIMAL(30,10) NOT NULL,
    "currency" VARCHAR(16) NOT NULL,
    "captured_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "portfolio_id" INT NOT NULL REFERENCES "portfolios" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_portfolio_s_capture_7962f4" ON "portfolio_snapshots" ("captured_at");
CREATE INDEX IF NOT EXISTS "idx_portfolio_s_portfol_0deb33" ON "portfolio_snapshots" ("portfolio_id", "captured_at");
COMMENT ON TABLE "portfolio_snapshots" IS 'Timeseries point: portfolio value over time (SPEC §4).';
CREATE TABLE IF NOT EXISTS "positions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "quantity" DECIMAL(30,10) NOT NULL,
    "entry_price" DECIMAL(30,10) NOT NULL,
    "currency" VARCHAR(16) NOT NULL,
    "is_closed" BOOL NOT NULL DEFAULT False,
    "opened_at" TIMESTAMPTZ NOT NULL,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" INT NOT NULL REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "portfolio_id" INT REFERENCES "portfolios" ("id") ON DELETE SET NULL,
    "user_id" INT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_positions_opened__eb1957" ON "positions" ("opened_at");
COMMENT ON TABLE "positions" IS 'Holding created automatically from a TRANSFER (SPEC §2).';
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "tx_type" VARCHAR(16) NOT NULL,
    "quantity" DECIMAL(30,10) NOT NULL,
    "price" DECIMAL(30,10) NOT NULL,
    "currency" VARCHAR(16) NOT NULL,
    "source_quantity" DECIMAL(30,10),
    "source_currency" VARCHAR(16),
    "timestamp" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" INT NOT NULL REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "portfolio_id" INT REFERENCES "portfolios" ("id") ON DELETE SET NULL,
    "source_asset_id" INT REFERENCES "assets" ("id") ON DELETE RESTRICT,
    "user_id" INT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_transaction_tx_type_caf6bc" ON "transactions" ("tx_type");
CREATE INDEX IF NOT EXISTS "idx_transaction_timesta_9f03af" ON "transactions" ("timestamp");
COMMENT ON COLUMN "transactions"."tx_type" IS 'INPUT: input\nTRANSFER: transfer\nOUTPUT: output';
COMMENT ON TABLE "transactions" IS 'Fundamental unit of the domain (SPEC §2).';
CREATE TABLE IF NOT EXISTS "aerich" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL
);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "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"
    "79Jj9PQPIZAVbg=="
)
