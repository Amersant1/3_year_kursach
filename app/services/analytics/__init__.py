"""Analytics math (SPEC §6 — now fully implemented, not stubbed).

Pure, dependency-light numpy functions that mirror every calculation the
frontend performs — returns, risk metrics, correlation, the MPT efficient
frontier, Monte-Carlo, concentration, comparison and fundamental valuation
(DCF / Gordon / CAPM / Black-Scholes).

These functions take plain numbers / numpy arrays and return plain
dicts/floats, so they are trivially unit-testable without a database. The
async orchestration that loads prices from the DB lives in
``app.services.analytics_service``.
"""
