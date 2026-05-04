"""Financial statements tool — yfinance 0.2.x (crumb-aware) + v10 fallback."""
from __future__ import annotations

from typing import List, Optional

import requests
import yfinance as yf
from pydantic import BaseModel

from ._common import normalize_ticker, safe_float

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_CONSENT_URL = "https://finance.yahoo.com/"
_CRUMB_URL = "https://query1.finance.yahoo.com/v1/test/getcrumb"
_V10_URL = (
    "https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}"
    "?modules=incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory"
    ",incomeStatementHistoryQuarterly,balanceSheetHistoryQuarterly"
    ",cashflowStatementHistoryQuarterly"
    "&crumb={crumb}"
)


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


def get_financials(ticker: str, period_type: str = "annual") -> Financials:
    norm = normalize_ticker(ticker)
    if not norm:
        return Financials(ticker=ticker or "", period_type=period_type, error="invalid ticker")
    if period_type not in ("annual", "quarterly"):
        return Financials(ticker=norm, period_type=period_type, error="period_type must be annual|quarterly")

    # --- Primary: yfinance (handles crumbs internally in 0.2.x) ---
    try:
        t = yf.Ticker(norm)
        if period_type == "annual":
            inc, bs, cf = t.financials, t.balance_sheet, t.cashflow
        else:
            inc, bs, cf = t.quarterly_financials, t.quarterly_balance_sheet, t.quarterly_cashflow

        if inc is not None and not inc.empty:
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
            if periods:
                return Financials(ticker=norm, period_type=period_type, periods=periods)
    except Exception:
        pass

    # --- Fallback: direct v10 API with crumb ---
    try:
        sess = requests.Session()
        sess.headers.update({"User-Agent": _UA, "Accept": "application/json"})
        sess.get(_CONSENT_URL, timeout=8)
        cr = sess.get(_CRUMB_URL, timeout=8)
        crumb = cr.text.strip() if cr.status_code == 200 else None
        if not crumb:
            return Financials(ticker=norm, period_type=period_type, error="crumb fetch failed")

        r = sess.get(_V10_URL.format(ticker=norm, crumb=crumb), timeout=20)
        r.raise_for_status()
        result = r.json().get("quoteSummary", {}).get("result") or []
        if not result:
            return Financials(ticker=norm, period_type=period_type, error="no data")
        data = result[0]
    except Exception as exc:
        return Financials(ticker=norm, period_type=period_type, error=f"fetch error: {exc}")

    suffix = "" if period_type == "annual" else "Quarterly"
    inc_list = (data.get(f"incomeStatementHistory{suffix}") or {}).get(f"incomeStatementHistory{suffix}", [])
    bs_list = (data.get(f"balanceSheetHistory{suffix}") or {}).get(f"balanceSheetStatements{suffix}", [])
    cf_list = (data.get(f"cashflowStatementHistory{suffix}") or {}).get(f"cashflowStatements{suffix}", [])

    def _rraw(obj: dict, key: str) -> Optional[float]:
        v = obj.get(key)
        return safe_float(v.get("raw") if isinstance(v, dict) else v)

    def _date(obj: dict) -> str:
        v = obj.get("endDate")
        if isinstance(v, dict):
            return v.get("fmt", str(v.get("raw", "")))
        return str(v or "")

    bs_by_date = {_date(x): x for x in bs_list}
    cf_by_date = {_date(x): x for x in cf_list}

    if not inc_list:
        return Financials(ticker=norm, period_type=period_type, error="no income statement data")

    periods = []
    for inc in inc_list[:4]:
        date = _date(inc)
        bs = bs_by_date.get(date, {})
        cf = cf_by_date.get(date, {})
        ocf = _rraw(cf, "totalCashFromOperatingActivities")
        capex = _rraw(cf, "capitalExpenditures")
        fcf = _rraw(cf, "freeCashFlow")
        if fcf is None and ocf is not None and capex is not None:
            fcf = ocf + capex
        periods.append(FinancialPeriod(
            period_end=date,
            revenue=_rraw(inc, "totalRevenue"),
            gross_profit=_rraw(inc, "grossProfit"),
            operating_income=_rraw(inc, "operatingIncome") or _rraw(inc, "ebit"),
            net_income=_rraw(inc, "netIncome"),
            ebitda=_rraw(inc, "ebitda"),
            eps_basic=_rraw(inc, "basicEPS") or _rraw(inc, "dilutedEPS"),
            free_cash_flow=fcf,
            total_debt=_rraw(bs, "totalDebt") or _rraw(bs, "longTermDebt"),
            total_equity=_rraw(bs, "totalStockholderEquity") or _rraw(bs, "stockholdersEquity"),
            cash_and_equivalents=_rraw(bs, "cash") or _rraw(bs, "cashAndCashEquivalents"),
        ))

    return Financials(ticker=norm, period_type=period_type, periods=periods)
