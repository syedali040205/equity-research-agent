"""Financial statements tool — SEC EDGAR XBRL (primary) with yfinance fallback."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel

from ._common import normalize_ticker, safe_float
from .edgar import EdgarFundamentals, ticker_to_cik


class FinancialPeriod(BaseModel):
    period_end: str
    revenue: Optional[float] = None
    gross_profit: Optional[float] = None
    operating_income: Optional[float] = None
    net_income: Optional[float] = None
    ebitda: Optional[float] = None
    eps_basic: Optional[float] = None
    free_cash_flow: Optional[float] = None
    total_debt: Optional[float] = None
    total_equity: Optional[float] = None
    cash_and_equivalents: Optional[float] = None


class Financials(BaseModel):
    ticker: str
    period_type: str
    periods: List[FinancialPeriod] = []
    error: Optional[str] = None


def _zip_series(*series_list, n: int = 4) -> list[str]:
    """Return up to n year-end dates that appear in any of the series."""
    dates: dict[str, None] = {}
    for s in series_list:
        for date, _ in s:
            dates[date] = None
    return list(dates.keys())[:n]


def _val(series: list[tuple[str, float]], date: str) -> Optional[float]:
    for d, v in series:
        if d == date:
            return v
    return None


def get_financials(ticker: str, period_type: str = "annual") -> Financials:
    norm = normalize_ticker(ticker)
    if not norm:
        return Financials(ticker=ticker or "", period_type=period_type, error="invalid ticker")
    if period_type not in ("annual", "quarterly"):
        return Financials(ticker=norm, period_type=period_type, error="period_type must be annual|quarterly")

    # Quarterly data from EDGAR requires per-10-Q filtering — fall through to yfinance for now
    if period_type == "quarterly":
        return _yfinance_financials(norm, period_type)

    # --- Annual: SEC EDGAR XBRL ---
    cik = ticker_to_cik(norm)
    if not cik:
        return _yfinance_financials(norm, period_type)

    try:
        edgar = EdgarFundamentals(cik)
        rev = edgar.revenue_series
        ni = edgar.net_income_series
        gp = edgar.gross_profit_series
        oi = edgar.operating_income_series
        eps = edgar.eps_series
        debt = edgar.total_debt_series
        equity = edgar.equity_series
        cash = edgar.cash_series
        ocf = edgar.ocf_series
        capex = edgar.capex_series

        dates = _zip_series(rev, ni, gp, oi, eps, n=4)
        if not dates:
            return _yfinance_financials(norm, period_type)

        periods: list[FinancialPeriod] = []
        for date in dates:
            ocf_val = _val(ocf, date)
            capex_val = _val(capex, date)
            fcf: Optional[float] = None
            if ocf_val is not None and capex_val is not None:
                fcf = ocf_val - capex_val  # capex from EDGAR is already positive outflow

            periods.append(FinancialPeriod(
                period_end=date,
                revenue=_val(rev, date),
                gross_profit=_val(gp, date),
                operating_income=_val(oi, date),
                net_income=_val(ni, date),
                eps_basic=_val(eps, date),
                free_cash_flow=fcf,
                total_debt=_val(debt, date),
                total_equity=_val(equity, date),
                cash_and_equivalents=_val(cash, date),
            ))

        if not periods:
            return _yfinance_financials(norm, period_type)

        return Financials(ticker=norm, period_type=period_type, periods=periods)

    except Exception as exc:
        return Financials(ticker=norm, period_type=period_type, error=str(exc))


def _yfinance_financials(ticker: str, period_type: str) -> Financials:
    """Fallback: yfinance (may fail in Docker if Yahoo v10 is blocked)."""
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        if period_type == "annual":
            inc, bs, cf = t.financials, t.balance_sheet, t.cashflow
        else:
            inc, bs, cf = t.quarterly_financials, t.quarterly_balance_sheet, t.quarterly_cashflow

        if inc is None or inc.empty:
            return Financials(ticker=ticker, period_type=period_type, error="no income statement data")

        def _safe(df, key: str, col) -> Optional[float]:
            if df is None or df.empty:
                return None
            for idx in df.index:
                if str(idx).strip().lower() == key.strip().lower():
                    try:
                        return safe_float(df.loc[idx, col])
                    except Exception:
                        return None
            return None

        periods: list[FinancialPeriod] = []
        for col in inc.columns[:4]:
            ocf = _safe(cf, "Total Cash From Operating Activities", col) or _safe(cf, "Operating Cash Flow", col)
            capex = _safe(cf, "Capital Expenditure", col) or _safe(cf, "Capital Expenditures", col)
            fcf = _safe(cf, "Free Cash Flow", col)
            if fcf is None and ocf is not None and capex is not None:
                fcf = ocf + capex

            periods.append(FinancialPeriod(
                period_end=str(col.date()) if hasattr(col, "date") else str(col),
                revenue=_safe(inc, "Total Revenue", col),
                gross_profit=_safe(inc, "Gross Profit", col),
                operating_income=_safe(inc, "Operating Income", col),
                net_income=_safe(inc, "Net Income", col),
                ebitda=_safe(inc, "EBITDA", col),
                eps_basic=_safe(inc, "Basic EPS", col),
                free_cash_flow=fcf,
                total_debt=_safe(bs, "Total Debt", col),
                total_equity=_safe(bs, "Stockholders Equity", col) or _safe(bs, "Total Stockholder Equity", col),
                cash_and_equivalents=_safe(bs, "Cash And Cash Equivalents", col) or _safe(bs, "Cash", col),
            ))

        if not periods:
            return Financials(ticker=ticker, period_type=period_type, error="no periods parsed")

        return Financials(ticker=ticker, period_type=period_type, periods=periods)

    except Exception as exc:
        return Financials(ticker=ticker, period_type=period_type, error=str(exc))
