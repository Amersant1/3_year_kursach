"""API / integration tests against the test Postgres.

Covers the SPEC §7 acceptance scenarios (auth flow, transfer→position, PnL,
output closes a position) plus the new analytics & report endpoints
end-to-end, with price history seeded directly via the ORM.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import numpy as np
import pytest

pytestmark = pytest.mark.asyncio


# --------------------------------------------------------------------------
# Auth (SPEC §7.3)
# --------------------------------------------------------------------------
async def test_auth_flow(client):
    r = await client.post(
        "/auth/register", json={"email": "a@b.com", "password": "password123"}
    )
    assert r.status_code == 201
    r = await client.post(
        "/auth/login", data={"username": "a@b.com", "password": "password123"}
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    # protected endpoint requires the token
    assert (await client.get("/auth/me")).status_code == 401
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == "a@b.com"


# --------------------------------------------------------------------------
# Transaction → position lifecycle (SPEC §7.3)
# --------------------------------------------------------------------------
async def _asset(client, **kw):
    r = await client.post("/assets", json=kw)
    assert r.status_code == 201, r.text
    return r.json()


async def test_transfer_creates_position_and_pnl_and_output_closes(auth_client):
    cash = await _asset(
        auth_client,
        symbol="RUB",
        name="Рубли",
        asset_class="custom",
        pricing_provider="manual",
        currency="RUB",
    )
    sber = await _asset(
        auth_client,
        symbol="SBER",
        name="Сбербанк",
        asset_class="stock_ru",
        pricing_provider="moex",
        currency="RUB",
    )
    # Fund cash, then transfer cash -> SBER (this is what creates the position).
    await auth_client.post(
        "/transactions",
        json={
            "tx_type": "input",
            "asset_id": cash["id"],
            "quantity": "100000",
            "price": "1",
            "currency": "RUB",
        },
    )
    r = await auth_client.post(
        "/transactions",
        json={
            "tx_type": "transfer",
            "asset_id": sber["id"],
            "quantity": "100",
            "price": "250",
            "currency": "RUB",
            "source_asset_id": cash["id"],
            "source_quantity": "25000",
            "source_currency": "RUB",
        },
    )
    assert r.status_code == 201, r.text

    positions = (await auth_client.get("/positions")).json()
    sber_pos = next(p for p in positions if p["asset_id"] == sber["id"])
    assert Decimal(sber_pos["quantity"]) == Decimal("100")
    assert Decimal(sber_pos["entry_price"]) == Decimal("250")

    # Set a manual quote of 300 → PnL = (300-250)*100 = 5000 (+20%).
    await auth_client.put(f"/assets/{sber['id']}/price", json={"price": "300"})
    pnl = (await auth_client.get(f"/positions/{sber_pos['id']}/pnl")).json()
    assert Decimal(pnl["pnl"]) == Decimal("5000")
    assert pnl["pnl_pct"] == pytest.approx(0.20)

    # Output the whole SBER position → it closes.
    out = await auth_client.post(
        "/transactions",
        json={
            "tx_type": "output",
            "asset_id": sber["id"],
            "quantity": "100",
            "price": "300",
            "currency": "RUB",
        },
    )
    assert out.status_code == 201
    after = (await auth_client.get(f"/positions/{sber_pos['id']}")).json()
    assert after["is_closed"] is True


async def test_output_overdraft_conflicts(auth_client):
    sber = await _asset(
        auth_client,
        symbol="SBER",
        name="Сбербанк",
        asset_class="stock_ru",
        pricing_provider="moex",
        currency="RUB",
    )
    await auth_client.post(
        "/transactions",
        json={
            "tx_type": "input",
            "asset_id": sber["id"],
            "quantity": "10",
            "price": "250",
            "currency": "RUB",
        },
    )
    r = await auth_client.post(
        "/transactions",
        json={
            "tx_type": "output",
            "asset_id": sber["id"],
            "quantity": "999",
            "price": "250",
            "currency": "RUB",
        },
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "insufficient_quantity"


# --------------------------------------------------------------------------
# Analytics end-to-end (seed price history directly)
# --------------------------------------------------------------------------
async def _seed_history(asset_id: int, *, start: float, currency: str, n: int = 120, seed: int = 1):
    from app.models import AssetQuote, PriceBar

    rng = np.random.default_rng(seed)
    px = start
    today = datetime.now(timezone.utc).date()
    bars = []
    for i in range(n):
        px = px * (1 + rng.normal(0.001, 0.012))
        bars.append(
            PriceBar(
                asset_id=asset_id,
                day=today - timedelta(days=n - i),
                close=Decimal(str(round(px, 4))),
                currency=currency,
                source="seed",
            )
        )
    await PriceBar.bulk_create(bars)
    await AssetQuote.create(
        asset_id=asset_id,
        price=Decimal(str(round(px, 4))),
        currency=currency,
        change_24h=Decimal("0.01"),
        source="seed",
        as_of=datetime.now(timezone.utc),
    )


async def _portfolio_with_two_assets(auth_client):
    from app.models import FxRate, Position, User

    user = await User.get(email="t@example.com")
    sber = await _asset(
        auth_client, symbol="SBER", name="Сбер", asset_class="stock_ru",
        pricing_provider="moex", currency="RUB", sector="Финансы", region="RU",
    )
    aapl = await _asset(
        auth_client, symbol="AAPL", name="Apple", asset_class="stock_us",
        pricing_provider="yahoo", currency="USD", sector="IT", region="US",
    )
    await _seed_history(sber["id"], start=250, currency="RUB", seed=11)
    await _seed_history(aapl["id"], start=180, currency="USD", seed=22)
    await FxRate.create(
        base="USD", quote="RUB", rate=Decimal("90"), source="seed",
        as_of=datetime.now(timezone.utc),
    )
    pf = (await auth_client.post("/portfolios", json={"name": "Main"})).json()
    now = datetime.now(timezone.utc)
    await Position.create(
        user_id=user.id, portfolio_id=pf["id"], asset_id=sber["id"],
        quantity=Decimal("100"), entry_price=Decimal("230"), currency="RUB",
        opened_at=now,
    )
    await Position.create(
        user_id=user.id, portfolio_id=pf["id"], asset_id=aapl["id"],
        quantity=Decimal("20"), entry_price=Decimal("170"), currency="USD",
        opened_at=now,
    )
    return pf, sber, aapl


async def test_analytics_endpoints(auth_client):
    pf, sber, aapl = await _portfolio_with_two_assets(auth_client)
    pid = pf["id"]

    val = (await auth_client.get(f"/portfolios/{pid}/valuation")).json()
    assert val["total_value"] is not None and len(val["holdings"]) == 2

    series = (await auth_client.get(f"/portfolios/{pid}/series")).json()
    assert len(series["values"]) > 10

    metrics = (await auth_client.get(f"/portfolios/{pid}/metrics")).json()
    assert "sharpe" in metrics and "max_drawdown" in metrics

    corr = (await auth_client.get(f"/portfolios/{pid}/correlation")).json()
    assert len(corr["labels"]) == 2 and len(corr["matrix"]) == 2

    fr = (await auth_client.get(f"/portfolios/{pid}/frontier")).json()
    assert len(fr["frontier"]) > 0 and fr["max_sharpe"]["sharpe"] is not None

    mc = (await auth_client.get(f"/portfolios/{pid}/montecarlo?horizon=60&n_sims=200")).json()
    assert len(mc["percentiles"]["p50"]) == 60 and 0 <= mc["prob_target"] <= 1

    conc = (await auth_client.get(f"/portfolios/{pid}/concentration")).json()
    assert len(conc["by_class"]) >= 1 and "hhi" in conc

    dash = (await auth_client.get("/dashboard")).json()
    assert dash["positions"] == 2 and dash["portfolios"] == 1

    cmp = (await auth_client.get(f"/analytics/compare?portfolio_id={pid}")).json()
    assert len(cmp["lines"]) == 1


async def test_fundamental_valuation_endpoint(auth_client):
    pf, sber, aapl = await _portfolio_with_two_assets(auth_client)
    await auth_client.put(
        f"/assets/{sber['id']}/fundamentals",
        json={
            "fcf_per_share": "20",
            "fcf_growth": "0.08",
            "discount_rate": "0.14",
            "terminal_growth": "0.03",
            "projection_years": 5,
            "dividend_per_share": "15",
            "dividend_growth": "0.05",
            "beta": "0.9",
            "market_return": "0.15",
        },
    )
    v = (await auth_client.get(f"/assets/{sber['id']}/valuation")).json()
    assert v["has_inputs"] is True
    assert v["dcf"]["value"] is not None and v["dcf"]["value"] > 0
    assert v["gordon"]["value"] is not None
    assert v["capm_expected_return"] == pytest.approx(0.07 + 0.9 * (0.15 - 0.07))


async def test_report_generation_xlsx(auth_client):
    pf, *_ = await _portfolio_with_two_assets(auth_client)
    r = await auth_client.post(
        "/reports/generate",
        json={
            "portfolio_id": pf["id"],
            "sections": ["summary", "holdings", "allocation", "risk"],
            "format": "xlsx",
        },
    )
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
    assert len(r.content) > 500  # a real xlsx file
