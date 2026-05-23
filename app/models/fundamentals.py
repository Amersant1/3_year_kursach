"""Per-asset valuation assumptions (inputs for fundamental models).

These are the user-provided inputs the analytics layer feeds into the real
DCF / Gordon Growth / CAPM / Black-Scholes formulas
(``app.services.analytics.fundamental``). All optional — a model is only
computed when its required inputs are present.

Decimal everywhere — never float (SPEC §1).
"""

from tortoise import fields
from tortoise.models import Model

_AMOUNT = {"max_digits": 30, "decimal_places": 10}


class AssetFundamentals(Model):
    """Valuation inputs for one asset (1:1)."""

    id = fields.IntField(pk=True)
    asset = fields.OneToOneField(
        "models.Asset", related_name="fundamentals", on_delete=fields.CASCADE
    )

    # --- Common ---
    shares_outstanding = fields.DecimalField(null=True, **_AMOUNT)

    # --- DCF (discounted cash flow) ---
    # Latest free cash flow per share, expected near-term growth (g),
    # discount rate (r / WACC), perpetual terminal growth, projection years.
    fcf_per_share = fields.DecimalField(null=True, **_AMOUNT)
    fcf_growth = fields.DecimalField(null=True, **_AMOUNT)
    discount_rate = fields.DecimalField(null=True, **_AMOUNT)
    terminal_growth = fields.DecimalField(null=True, **_AMOUNT)
    projection_years = fields.IntField(null=True)

    # --- Gordon growth (dividend discount) ---
    dividend_per_share = fields.DecimalField(null=True, **_AMOUNT)
    dividend_growth = fields.DecimalField(null=True, **_AMOUNT)
    # Required return for Gordon; falls back to CAPM expected return if null.
    required_return = fields.DecimalField(null=True, **_AMOUNT)

    # --- CAPM ---
    beta = fields.DecimalField(null=True, **_AMOUNT)
    risk_free_rate = fields.DecimalField(null=True, **_AMOUNT)
    market_return = fields.DecimalField(null=True, **_AMOUNT)

    # --- Black-Scholes (option valuation on the asset as underlying) ---
    strike = fields.DecimalField(null=True, **_AMOUNT)
    time_to_expiry = fields.DecimalField(null=True, **_AMOUNT)  # years
    bs_volatility = fields.DecimalField(null=True, **_AMOUNT)  # annual σ
    bs_rate = fields.DecimalField(null=True, **_AMOUNT)  # risk-free for BS

    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "asset_fundamentals"

    def __str__(self) -> str:
        return f"AssetFundamentals(asset={self.asset_id})"
