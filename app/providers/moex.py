"""MOEX (Moscow Exchange) ISS provider — RU stocks, bonds, ETFs (SPEC §3).

Public ISS API, no key. We resolve the right engine/market/board from the
asset class, read the last price from ``marketdata`` and daily closes from the
``history`` endpoint. Everything degrades gracefully on failure.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from app.config import settings
from app.providers.base import PriceProvider, ProviderBar, ProviderQuote

# engine / market / primary board per asset class.
_MARKETS = {
    "stock_ru": ("stock", "shares", "TQBR"),
    "etf": ("stock", "shares", "TQTF"),
    "bond": ("stock", "bonds", "TQOB"),
}
# Candidate close columns in order of preference (bonds quote in % of par).
_CLOSE_COLS = ("CLOSE", "LEGALCLOSEPRICE", "MARKETPRICE", "WAPRICE")
_LAST_COLS = ("LAST", "MARKETPRICE", "LCURRENTPRICE", "WAPRICE", "PREVPRICE")


def _rows(block: dict | None) -> list[dict]:
    """Turn an ISS ``{columns:[...], data:[[...]]}`` block into dicts."""
    if not block:
        return []
    cols = block.get("columns") or []
    return [dict(zip(cols, row)) for row in block.get("data") or []]


def _dec(value) -> Decimal | None:
    if value in (None, "", "null"):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


class MoexProvider(PriceProvider):
    name = "moex"

    def _route(self, asset_class: str | None) -> tuple[str, str, str]:
        return _MARKETS.get(asset_class or "", _MARKETS["stock_ru"])

    async def get_quote(
        self, symbol, *, provider_symbol, currency, asset_class=None
    ) -> ProviderQuote | None:
        secid = (provider_symbol or symbol).upper()
        engine, market, board = self._route(asset_class)
        url = (
            f"{settings.moex_base_url}/engines/{engine}/markets/{market}"
            f"/boards/{board}/securities/{secid}.json"
        )
        data = await self._get_json(
            url, {"iss.meta": "off", "iss.only": "marketdata"}
        )
        if not data:
            return None
        for row in _rows(data.get("marketdata")):
            price = next((_dec(row.get(c)) for c in _LAST_COLS if _dec(row.get(c))), None)
            if price is not None and price > 0:
                return ProviderQuote(
                    price=price, currency=currency, as_of=datetime.now(timezone.utc)
                )
        return None

    async def get_history(
        self, symbol, *, provider_symbol, currency, days, asset_class=None
    ) -> list[ProviderBar]:
        secid = (provider_symbol or symbol).upper()
        engine, market, board = self._route(asset_class)
        frm = (date.today() - timedelta(days=days)).isoformat()
        out: list[ProviderBar] = []
        # ISS paginates history at 100 rows/page via the ``start`` cursor.
        for start in range(0, 5000, 100):
            url = (
                f"{settings.moex_base_url}/history/engines/{engine}/markets/"
                f"{market}/boards/{board}/securities/{secid}.json"
            )
            data = await self._get_json(
                url, {"iss.meta": "off", "from": frm, "start": start}
            )
            rows = _rows((data or {}).get("history"))
            if not rows:
                break
            for row in rows:
                tradedate = row.get("TRADEDATE")
                close = next(
                    (_dec(row.get(c)) for c in _CLOSE_COLS if _dec(row.get(c))), None
                )
                if tradedate and close and close > 0:
                    out.append(
                        ProviderBar(
                            day=date.fromisoformat(tradedate),
                            close=close,
                            currency=currency,
                        )
                    )
            if len(rows) < 100:
                break
        out.sort(key=lambda b: b.day)
        return out
