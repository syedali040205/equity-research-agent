"""
Derived financial metrics — pure math on the structured Financials object.

The agent uses these to avoid letting the LLM do arithmetic on raw revenue/income
numbers (LLMs are unreliable at division). Compute it deterministically here,
hand back nicely-named fields.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from .financials import Financials


class DerivedMetrics(BaseModel):
    ticker: str
    latest_period: Optional[str] = None

    revenue_yoy_growth_pct: Optional[float] = None
    gross_margin_pct: Optional[float] = None
    operating_margin_pct: Optional[float] = None
    net_margin_pct: Optional[float] = None

    debt_to_equity: Optional[float] = None
    fcf_margin_pct: Optional[float] = None

    error: Optional[str] = None


def _pct(numer: Optional[float], denom: Optional[float]) -> Optional[float]:
    if numer is None or denom is None or denom == 0:
        return None
    return round((numer / denom) * 100, 2)


def _ratio(numer: Optional[float], denom: Optional[float]) -> Optional[float]:
    if numer is None or denom is None or denom == 0:
        return None
    return round(numer / denom, 2)


def compute_derived_metrics(fin: Financials) -> DerivedMetrics:
    if fin.error or not fin.periods:
        return DerivedMetrics(ticker=fin.ticker, error=fin.error or "no periods")

    latest = fin.periods[0]
    prior = fin.periods[1] if len(fin.periods) > 1 else None

    return DerivedMetrics(
        ticker=fin.ticker,
        latest_period=latest.period_end,
        revenue_yoy_growth_pct=_pct(
            (latest.revenue - prior.revenue) if (latest.revenue and prior and prior.revenue) else None,
            prior.revenue if prior else None,
        ),
        gross_margin_pct=_pct(latest.gross_profit, latest.revenue),
        operating_margin_pct=_pct(latest.operating_income, latest.revenue),
        net_margin_pct=_pct(latest.net_income, latest.revenue),
        debt_to_equity=_ratio(latest.total_debt, latest.total_equity),
        fcf_margin_pct=_pct(latest.free_cash_flow, latest.revenue),
    )
