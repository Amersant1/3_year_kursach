"""One-shot script to repair assets whose ``name`` / ``sector`` / ``region``
got stored with broken encoding (Cyrillic round-tripped through a non-UTF-8
HTTP body shows up as a row of ``?``).

Runs idempotently — only rows containing ``?`` in any text field are
touched. Each (symbol, asset_class) pair is matched against the dictionary
below; unknown symbols are left as-is (script prints them so the operator
can extend the dictionary).

Usage (inside the backend container):

    docker compose exec backend python -m app.scripts.repair_assets

The script opens its own Tortoise connection — no need to run the API
server. Safe to re-run.
"""

from __future__ import annotations

import asyncio
import sys

from tortoise import Tortoise

from app.db import TORTOISE_ORM
from app.models import Asset


# (symbol, asset_class) -> {"name": ..., "sector": ..., "region": ...}
# Only the fields you want to overwrite need to be present.
KNOWN: dict[tuple[str, str], dict[str, str]] = {
    ("SBER", "stock_ru"):  {"name": "Сбербанк",   "sector": "Финансы",    "region": "RU"},
    ("GAZP", "stock_ru"):  {"name": "Газпром",    "sector": "Энергетика", "region": "RU"},
    ("LKOH", "stock_ru"):  {"name": "ЛУКОЙЛ",     "sector": "Нефтегаз",   "region": "RU"},
    ("GMKN", "stock_ru"):  {"name": "Норникель",  "sector": "Металлы",    "region": "RU"},
    ("ROSN", "stock_ru"):  {"name": "Роснефть",   "sector": "Нефтегаз",   "region": "RU"},
    ("MGNT", "stock_ru"):  {"name": "Магнит",     "sector": "Ритейл",     "region": "RU"},
    ("NVTK", "stock_ru"):  {"name": "НОВАТЭК",    "sector": "Нефтегаз",   "region": "RU"},
    ("YNDX", "stock_ru"):  {"name": "Яндекс",     "sector": "Tech",       "region": "RU"},
    ("VTBR", "stock_ru"):  {"name": "ВТБ",        "sector": "Финансы",    "region": "RU"},
    ("MOEX", "stock_ru"):  {"name": "Мосбиржа",   "sector": "Финансы",    "region": "RU"},
    ("PLZL", "stock_ru"):  {"name": "Полюс",      "sector": "Металлы",    "region": "RU"},

    ("SBMX", "etf"):       {"name": "Сбер ММВБ ETF", "sector": "Индекс",    "region": "RU"},
    ("FXRL", "etf"):       {"name": "FinEx Russia",  "sector": "Индекс",    "region": "RU"},
    ("FXIT", "etf"):       {"name": "FinEx IT",      "sector": "Tech",      "region": "RU"},

    ("OFZ26", "bond"):     {"name": "ОФЗ 26240",     "sector": "Облигации", "region": "RU"},
    ("OFZ52", "bond"):     {"name": "ОФЗ 52004",     "sector": "Облигации", "region": "RU"},
}


def _is_broken(s: str | None) -> bool:
    return bool(s) and "?" in s


async def repair() -> None:
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        all_assets = await Asset.all()
        touched = 0
        unknown: list[Asset] = []
        for a in all_assets:
            if not (_is_broken(a.name) or _is_broken(a.sector) or _is_broken(a.region)):
                continue
            key = (a.symbol, a.asset_class.value if hasattr(a.asset_class, "value") else str(a.asset_class))
            fix = KNOWN.get(key)
            if fix is None:
                unknown.append(a)
                continue
            if "name" in fix:
                a.name = fix["name"]
            if "sector" in fix:
                a.sector = fix["sector"]
            if "region" in fix:
                a.region = fix["region"]
            await a.save()
            touched += 1
            print(f"  fixed #{a.id} {a.symbol} ({key[1]}) -> {fix}")

        print(f"\nRepaired {touched} asset row(s).")
        if unknown:
            print(f"\nUnknown broken assets ({len(unknown)}) — add to KNOWN dict and re-run:")
            for a in unknown:
                print(
                    f"  #{a.id} symbol={a.symbol!r} class={a.asset_class!r} "
                    f"name={a.name!r} sector={a.sector!r} region={a.region!r}"
                )
    finally:
        await Tortoise.close_connections()


def main() -> int:
    asyncio.run(repair())
    return 0


if __name__ == "__main__":
    sys.exit(main())
