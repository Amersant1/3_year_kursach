"""Concentration, allocation breakdowns, P&L decomposition & movers.

Ports the dashboard helpers (``dashboard.jsx``): treemap/allocation by any
key, top-N concentration, P&L decomposition with win-rate, and 24h movers /
winners / losers. Operates on a uniform list of valued-position dicts so it
stays DB-agnostic. Each item: ``{label, value, pnl, pnl_pct, day_change,
asset_class, currency, region}``.
"""

from __future__ import annotations


def _total(items: list[dict], field: str = "value") -> float:
    return float(sum(float(i.get(field, 0.0)) for i in items))


def top_n_share(items: list[dict], n: int = 3) -> float:
    """Share of total value held by the n largest positions."""
    total = _total(items)
    if total == 0:
        return 0.0
    top = sorted(items, key=lambda i: float(i["value"]), reverse=True)[:n]
    return float(sum(float(i["value"]) for i in top) / total)


def herfindahl(items: list[dict]) -> float:
    """Herfindahl-Hirschman index of value weights (0..1, higher = concentrated)."""
    total = _total(items)
    if total == 0:
        return 0.0
    return float(sum((float(i["value"]) / total) ** 2 for i in items))


def breakdown(items: list[dict], key: str) -> list[dict]:
    """Aggregate value by a categorical key (asset_class / currency / region)."""
    total = _total(items)
    buckets: dict[str, float] = {}
    for i in items:
        k = str(i.get(key) or "—")
        buckets[k] = buckets.get(k, 0.0) + float(i["value"])
    rows = [
        {"label": k, "value": v, "share": (v / total if total else 0.0)}
        for k, v in buckets.items()
    ]
    return sorted(rows, key=lambda r: r["value"], reverse=True)


def allocation(items: list[dict], *, top: int = 12) -> list[dict]:
    """Per-asset allocation (treemap), largest first with share."""
    total = _total(items)
    rows = sorted(items, key=lambda i: float(i["value"]), reverse=True)[:top]
    return [
        {
            "label": r["label"],
            "value": float(r["value"]),
            "share": float(r["value"]) / total if total else 0.0,
        }
        for r in rows
    ]


def pnl_decomposition(items: list[dict], *, top: int = 9) -> dict:
    """Largest P&L contributors split into gains/losses with win-rate."""
    ranked = sorted(items, key=lambda i: abs(float(i["pnl"])), reverse=True)[:top]
    contributors = [
        {"label": i["label"], "value": float(i["pnl"])} for i in ranked
    ]
    positive = sum(c["value"] for c in contributors if c["value"] > 0)
    negative = sum(c["value"] for c in contributors if c["value"] < 0)
    wins = sum(1 for c in contributors if c["value"] > 0)
    return {
        "contributors": contributors,
        "positive": positive,
        "negative": negative,
        "net": positive + negative,
        "win_rate": (wins / len(contributors)) if contributors else 0.0,
    }


def movers(items: list[dict], *, n: int = 5) -> list[dict]:
    """Largest absolute 24h movers (dedup by label)."""
    seen: set[str] = set()
    unique: list[dict] = []
    for i in items:
        if i["label"] in seen:
            continue
        seen.add(i["label"])
        unique.append(i)
    return sorted(unique, key=lambda i: abs(float(i["day_change"])), reverse=True)[:n]


def winners_losers(items: list[dict], *, n: int = 3) -> dict:
    """Top gainers / losers by total PnL percentage."""
    by_pct = sorted(items, key=lambda i: float(i["pnl_pct"]), reverse=True)
    return {"winners": by_pct[:n], "losers": by_pct[-n:][::-1]}
