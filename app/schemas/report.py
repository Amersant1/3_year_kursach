from enum import Enum

from pydantic import BaseModel, Field


class ReportFormat(str, Enum):
    CSV = "csv"
    XLSX = "xlsx"
    # PDF is intentionally not offered yet (planned next iteration).


class ReportSection(str, Enum):
    SUMMARY = "summary"
    HOLDINGS = "holdings"
    ALLOCATION = "allocation"
    PERFORMANCE = "performance"
    RISK = "risk"
    TRANSACTIONS = "transactions"
    VALUATION = "valuation"
    MC = "mc"


class ReportRequest(BaseModel):
    # None == all of the user's portfolios aggregated.
    portfolio_id: int | None = None
    sections: list[ReportSection] = Field(
        default_factory=lambda: [
            ReportSection.SUMMARY,
            ReportSection.HOLDINGS,
            ReportSection.ALLOCATION,
            ReportSection.RISK,
        ],
        min_length=1,
    )
    format: ReportFormat = ReportFormat.XLSX
    days: int | None = Field(default=None, ge=2, le=3650)
