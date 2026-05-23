from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "asset_fundamentals" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "shares_outstanding" DECIMAL(30,10),
    "fcf_per_share" DECIMAL(30,10),
    "fcf_growth" DECIMAL(30,10),
    "discount_rate" DECIMAL(30,10),
    "terminal_growth" DECIMAL(30,10),
    "projection_years" INT,
    "dividend_per_share" DECIMAL(30,10),
    "dividend_growth" DECIMAL(30,10),
    "required_return" DECIMAL(30,10),
    "beta" DECIMAL(30,10),
    "risk_free_rate" DECIMAL(30,10),
    "market_return" DECIMAL(30,10),
    "strike" DECIMAL(30,10),
    "time_to_expiry" DECIMAL(30,10),
    "bs_volatility" DECIMAL(30,10),
    "bs_rate" DECIMAL(30,10),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" INT NOT NULL UNIQUE REFERENCES "assets" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "asset_fundamentals" IS 'Valuation inputs for one asset (1:1).';
        CREATE TABLE IF NOT EXISTS "asset_quotes" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "price" DECIMAL(30,10) NOT NULL,
    "currency" VARCHAR(16) NOT NULL,
    "change_24h" DECIMAL(30,10),
    "source" VARCHAR(16) NOT NULL,
    "as_of" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" INT NOT NULL UNIQUE REFERENCES "assets" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "asset_quotes" IS 'Latest spot price for an asset. Upserted by the price refresh task.';
        CREATE TABLE IF NOT EXISTS "fx_rates" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "base" VARCHAR(16) NOT NULL,
    "quote" VARCHAR(16) NOT NULL,
    "rate" DECIMAL(30,10) NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "as_of" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uid_fx_rates_base_aeee23" UNIQUE ("base", "quote")
);
COMMENT ON TABLE "fx_rates" IS 'Latest FX conversion rate for a currency pair (e.g. USD/RUB).';
        CREATE TABLE IF NOT EXISTS "price_bars" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "day" DATE NOT NULL,
    "close" DECIMAL(30,10) NOT NULL,
    "currency" VARCHAR(16) NOT NULL,
    "source" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" INT NOT NULL REFERENCES "assets" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_price_bars_asset_i_b0a538" UNIQUE ("asset_id", "day")
);
CREATE INDEX IF NOT EXISTS "idx_price_bars_asset_i_b0a538" ON "price_bars" ("asset_id", "day");
COMMENT ON TABLE "price_bars" IS 'One daily close for an asset (append-only timeseries).';
        ALTER TABLE "assets" ADD "sector" VARCHAR(64);
        ALTER TABLE "assets" ADD "provider_symbol" VARCHAR(128);
        ALTER TABLE "assets" ADD "region" VARCHAR(16);
        ALTER TABLE "assets" ADD "currency" VARCHAR(16) NOT NULL DEFAULT 'RUB';
        COMMENT ON COLUMN "assets"."asset_class" IS 'STOCK: stock
STOCK_RU: stock_ru
STOCK_US: stock_us
BOND: bond
ETF: etf
CRYPTO: crypto
CUSTOM: custom';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "assets" DROP COLUMN "sector";
        ALTER TABLE "assets" DROP COLUMN "provider_symbol";
        ALTER TABLE "assets" DROP COLUMN "region";
        ALTER TABLE "assets" DROP COLUMN "currency";
        COMMENT ON COLUMN "assets"."asset_class" IS 'STOCK: stock
STOCK_RU: stock_ru
CRYPTO: crypto
CUSTOM: custom';
        DROP TABLE IF EXISTS "asset_quotes";
        DROP TABLE IF EXISTS "asset_fundamentals";
        DROP TABLE IF EXISTS "price_bars";
        DROP TABLE IF EXISTS "fx_rates";"""


MODELS_STATE = (
    "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"
)
