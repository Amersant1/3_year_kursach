# CURS — Portfolio Tracker (backend)

Self-hosted investment-portfolio backend. **All** computation the frontend
(`frontend/`) used to do in the browser now lives here: portfolio valuation &
PnL, risk metrics, correlation, the Markowitz efficient frontier, Monte-Carlo,
concentration, comparison, fundamental valuation (DCF / Gordon / CAPM /
Black-Scholes) and report generation.

Stack: FastAPI · Tortoise ORM · PostgreSQL · Aerich · Celery + Redis ·
Pydantic v2 · numpy. Money is `Decimal`; statistical analytics use float/numpy.

## Run it

```bash
cp .env.example .env            # adjust JWT_SECRET for anything real
docker compose up --build       # postgres, redis, backend, celery worker + beat
# migrations apply automatically (RUN_MIGRATIONS=1 on the backend service)
```

API: <http://localhost:8080>, interactive docs: <http://localhost:8080/docs>.

Seed the demo universe (assets, portfolios, positions) and pull live prices:

```bash
docker compose exec backend python -m app.seed
# demo login: demo@curs.local / demo-password-123
```

## Pricing providers (SPEC §3)

Abstract `PriceProvider` (`app/providers/base.py`) + implementations, each with
a per-request timeout and graceful degradation (a failed fetch never crashes
the service — the last known price is kept):

| Provider   | Source                         | Assets             |
|------------|--------------------------------|--------------------|
| `moex`     | MOEX ISS (public)              | RU stocks/bonds/ETF|
| `coingecko`| CoinGecko (public)             | crypto             |
| `yahoo`    | Yahoo Finance chart (public)   | US stocks/ETF      |
| `custom`   | user-supplied JSON endpoint    | alt. assets        |
| `manual`   | price set by hand              | illiquid assets    |

FX (`USD/RUB`) comes from the MOEX currency market (CoinGecko fallback) and is
applied flat across history when valuing foreign-currency assets in the base
currency. Prices/history are stored in `asset_quotes` / `price_bars`; the
Celery beat task `refresh_all_prices` keeps them fresh and
`capture_all_snapshots` appends `portfolio_snapshots` for charts.

## Analytics endpoints

All require a Bearer token (`POST /auth/login`).

| Endpoint | What |
|---|---|
| `GET /dashboard` | aggregate value, allocation, movers, P&L decomposition |
| `GET /portfolios/{id}/valuation` | value, cost, PnL, per-position breakdown |
| `GET /portfolios/{id}/series` | reconstructed equity curve |
| `GET /portfolios/{id}/metrics` | σ, CAGR, Sharpe, Sortino, Beta, Info-Ratio, MaxDD, Calmar, VaR, CVaR, drawdown |
| `GET /portfolios/{id}/correlation` | Pearson matrix + top pairs / diversifiers |
| `GET /portfolios/{id}/frontier` | Markowitz efficient frontier (MPT) |
| `GET /portfolios/{id}/montecarlo` | GBM simulation, percentile fan, P(target), VaR, histogram |
| `GET /portfolios/{id}/concentration` | top-N, HHI, breakdowns by class/currency/region |
| `GET /analytics/compare?portfolio_id=…` | normalized returns + risk/return scatter |
| `GET /positions/{id}/pnl` | detailed position PnL |
| `GET /assets/{id}/valuation` | DCF / Gordon / CAPM / Black-Scholes |
| `PUT /assets/{id}/fundamentals` | set valuation assumptions |
| `POST /assets/{id}/refresh` · `PUT /assets/{id}/price` | refresh / set price |
| `POST /reports/generate` | build a CSV/XLSX report (PDF planned next) |

The analytics math is isolated, pure and unit-tested in
`app/services/analytics/` (no DB); `app/services/analytics_service.py` does the
async DB orchestration and routers stay thin (SPEC §5).

## Tests

```bash
# one-off test database (host Postgres on :5432)
docker compose up -d postgres
docker exec portfolio-postgres-1 psql -U portfolio -d portfolio \
  -c "CREATE DATABASE portfolio_test;"
uv run pytest                    # 13 pure-math + 8 API/integration tests
```

Key scenarios: transfer→position, weighted-average entry, output closes a
position, overdraft 409, auth flow, and every analytics endpoint end-to-end,
plus known-value math checks (Black-Scholes textbook value, Gordon, max
drawdown, Monte-Carlo determinism, …).
