"""Demo seed — create the asset universe, a demo user, portfolios and
positions that mirror the frontend (``frontend/data.js``), then pull live
prices so every analytics endpoint has data to work with.

Run once after migrations::

    python -m app.seed            # inside the backend container / venv

Idempotent: re-running updates rather than duplicates. Price fetches degrade
gracefully — assets whose provider can't resolve simply stay unpriced.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal

from tortoise import Tortoise

from app.db import TORTOISE_ORM
from app.models import Asset, AssetFundamentals, Portfolio, Position, User
from app.models.asset import AssetClass, PricingProvider
from app.core.security import hash_password
from app.services import pricing_service

DEMO_EMAIL = "demo@curs.local"
DEMO_PASSWORD = "demo-password-123"

# symbol, name, class, provider, currency, sector, region, provider_symbol
ASSETS = [
    ("SBER", "Сбербанк", AssetClass.STOCK_RU, PricingProvider.MOEX, "RUB", "Финансы", "RU", "SBER"),
    ("GAZP", "Газпром", AssetClass.STOCK_RU, PricingProvider.MOEX, "RUB", "Энергия", "RU", "GAZP"),
    ("LKOH", "Лукойл", AssetClass.STOCK_RU, PricingProvider.MOEX, "RUB", "Энергия", "RU", "LKOH"),
    ("TCSG", "TCS Group", AssetClass.STOCK_RU, PricingProvider.MOEX, "RUB", "Финансы", "RU", "T"),
    ("AAPL", "Apple", AssetClass.STOCK_US, PricingProvider.YAHOO, "USD", "IT", "US", "AAPL"),
    ("NVDA", "NVIDIA", AssetClass.STOCK_US, PricingProvider.YAHOO, "USD", "IT", "US", "NVDA"),
    ("MSFT", "Microsoft", AssetClass.STOCK_US, PricingProvider.YAHOO, "USD", "IT", "US", "MSFT"),
    ("BTC", "Bitcoin", AssetClass.CRYPTO, PricingProvider.COINGECKO, "USD", "Crypto", "—", "bitcoin"),
    ("ETH", "Ethereum", AssetClass.CRYPTO, PricingProvider.COINGECKO, "USD", "Crypto", "—", "ethereum"),
    ("FLAT_MSK", "Квартира, Москва", AssetClass.CUSTOM, PricingProvider.MANUAL, "RUB", "Недвижимость", "RU", None),
]

# portfolio id, name, description, [(symbol, qty, avg_price)]
PORTFOLIOS = [
    ("Основной", "Сбалансированный мультивалютный портфель", [
        ("SBER", "420", "245"), ("LKOH", "26", "7100"), ("GAZP", "1100", "158"),
        ("AAPL", "38", "184.5"), ("NVDA", "95", "91.2"), ("BTC", "0.42", "62400"),
        ("ETH", "4.1", "2640"), ("FLAT_MSK", "1", "12500000"),
    ]),
    ("Долгосрочный", "Накопления и облигации", [
        ("LKOH", "14", "6900"), ("TCSG", "22", "3000"), ("MSFT", "18", "380"),
    ]),
    ("Эксперимент", "Crypto + tech ставки", [
        ("BTC", "0.18", "73000"), ("ETH", "6.0", "3100"), ("NVDA", "24", "132"),
    ]),
]

# A couple of fundamental-valuation inputs so /valuation has something to show.
FUNDAMENTALS = {
    "SBER": dict(fcf_per_share="55", fcf_growth="0.07", discount_rate="0.16",
                 terminal_growth="0.04", projection_years=5,
                 dividend_per_share="33", dividend_growth="0.06",
                 beta="0.95", market_return="0.18"),
    "AAPL": dict(fcf_per_share="7", fcf_growth="0.09", discount_rate="0.10",
                 terminal_growth="0.03", projection_years=5,
                 dividend_per_share="1", dividend_growth="0.05",
                 beta="1.2", market_return="0.11"),
}


async def _seed() -> None:
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        user, _ = await User.get_or_create(
            email=DEMO_EMAIL,
            defaults={"hashed_password": hash_password(DEMO_PASSWORD)},
        )

        assets: dict[str, Asset] = {}
        for sym, name, cls, prov, ccy, sector, region, psym in ASSETS:
            asset, _ = await Asset.get_or_create(
                symbol=sym,
                asset_class=cls,
                defaults={
                    "name": name, "pricing_provider": prov, "currency": ccy,
                    "sector": sector, "region": region, "provider_symbol": psym,
                },
            )
            assets[sym] = asset

        for fund_sym, values in FUNDAMENTALS.items():
            await AssetFundamentals.update_or_create(
                asset_id=assets[fund_sym].id,
                defaults={k: Decimal(v) if isinstance(v, str) else v for k, v in values.items()},
            )

        now = datetime.now(timezone.utc)
        for name, desc, holdings in PORTFOLIOS:
            pf, _ = await Portfolio.get_or_create(
                name=name, user=user, defaults={"description": desc}
            )
            for sym, qty, avg in holdings:
                await Position.update_or_create(
                    user_id=user.id,
                    portfolio_id=pf.id,
                    asset_id=assets[sym].id,
                    defaults={
                        "quantity": Decimal(qty),
                        "entry_price": Decimal(avg),
                        "currency": assets[sym].currency,
                        "is_closed": False,
                        "opened_at": now,
                    },
                )

        # Manual price for the apartment, then live refresh for everything.
        await pricing_service.set_manual_quote(assets["FLAT_MSK"], Decimal("14200000"))
        report = await pricing_service.refresh_all()
        print(f"Seeded user={DEMO_EMAIL} assets={len(assets)} "
              f"portfolios={len(PORTFOLIOS)}; price refresh: {report}")
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(_seed())
