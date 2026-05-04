"""SEC EDGAR XBRL API — free, no auth, works from any IP including Docker.

Provides fundamental data: revenue, net income, EPS, shares outstanding.
All values come from https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

import requests

from ._common import safe_float, safe_int

_EDGAR_UA = "EquityAgent/1.0 contact@example.com"
_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"


def _edgar_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": _EDGAR_UA, "Accept": "application/json"})
    return s


@lru_cache(maxsize=1)
def _load_ticker_to_cik() -> dict[str, str]:
    """Load full SEC ticker→CIK mapping (cached in-process)."""
    try:
        r = _edgar_session().get(_TICKERS_URL, timeout=15)
        r.raise_for_status()
        data = r.json()
        return {v["ticker"].upper(): str(v["cik_str"]).zfill(10) for v in data.values()}
    except Exception:
        return {}


def ticker_to_cik(ticker: str) -> Optional[str]:
    """Return zero-padded 10-digit CIK for a ticker, or None."""
    mapping = _load_ticker_to_cik()
    return mapping.get(ticker.upper())


def _latest_value(facts: dict, concept: str, form_filter: str = "10-K") -> Optional[float]:
    """Get most recent filed value for a US-GAAP concept."""
    try:
        units = facts["facts"]["us-gaap"][concept]["units"]
        # prefer USD, then USD/shares (EPS), then shares
        entries = units.get("USD") or units.get("USD/shares") or units.get("shares") or []
        # Filter to annual 10-K filings, pick most recent end date
        annual = [e for e in entries if e.get("form") == form_filter and e.get("val") is not None]
        if not annual:
            # accept any form
            annual = [e for e in entries if e.get("val") is not None]
        if not annual:
            return None
        annual.sort(key=lambda e: e.get("end", ""), reverse=True)
        return safe_float(annual[0]["val"])
    except (KeyError, IndexError, TypeError):
        return None


def _annual_series(facts: dict, concept: str, n: int = 4) -> list[tuple[str, float]]:
    """Return up to n (year_end, value) tuples for 10-K filings, newest first."""
    try:
        units = facts["facts"]["us-gaap"][concept]["units"]
        entries = units.get("USD") or units.get("USD/shares") or units.get("shares") or []
        annual = [
            e for e in entries
            if e.get("form") == "10-K" and e.get("val") is not None
            and e.get("end") and len(e["end"]) == 10
        ]
        # deduplicate by end date (pick the one filed latest)
        seen: dict[str, dict] = {}
        for e in annual:
            end = e["end"]
            if end not in seen or e.get("filed", "") > seen[end].get("filed", ""):
                seen[end] = e
        deduped = sorted(seen.values(), key=lambda e: e["end"], reverse=True)
        return [(e["end"], safe_float(e["val"])) for e in deduped[:n] if safe_float(e["val"]) is not None]
    except (KeyError, TypeError):
        return []


class EdgarFundamentals:
    """Lazy-loaded EDGAR facts for one company."""

    def __init__(self, cik: str):
        self.cik = cik.zfill(10)
        self._facts: Optional[dict] = None
        self._loaded = False

    def _load(self):
        if self._loaded:
            return
        self._loaded = True
        try:
            r = _edgar_session().get(_FACTS_URL.format(cik=self.cik), timeout=20)
            if r.status_code == 200:
                self._facts = r.json()
        except Exception:
            pass

    @property
    def facts(self) -> Optional[dict]:
        self._load()
        return self._facts

    def latest(self, concept: str, form: str = "10-K") -> Optional[float]:
        f = self.facts
        return _latest_value(f, concept, form) if f else None

    def series(self, concept: str, n: int = 4) -> list[tuple[str, float]]:
        f = self.facts
        return _annual_series(f, concept, n) if f else []

    # --- Convenience properties ---

    @property
    def shares_outstanding(self) -> Optional[float]:
        # CommonStockSharesOutstanding is most reliable
        v = self.latest("CommonStockSharesOutstanding", "10-K")
        if v is None:
            v = self.latest("EntityCommonStockSharesOutstanding", "10-K")
        return v

    @property
    def revenue_series(self) -> list[tuple[str, float]]:
        s = self.series("RevenueFromContractWithCustomerExcludingAssessedTax")
        if not s:
            s = self.series("Revenues")
        if not s:
            s = self.series("SalesRevenueNet")
        return s

    @property
    def net_income_series(self) -> list[tuple[str, float]]:
        return self.series("NetIncomeLoss")

    @property
    def eps_series(self) -> list[tuple[str, float]]:
        s = self.series("EarningsPerShareBasic")
        if not s:
            s = self.series("EarningsPerShareDiluted")
        return s

    @property
    def gross_profit_series(self) -> list[tuple[str, float]]:
        return self.series("GrossProfit")

    @property
    def operating_income_series(self) -> list[tuple[str, float]]:
        return self.series("OperatingIncomeLoss")

    @property
    def total_debt_series(self) -> list[tuple[str, float]]:
        s = self.series("LongTermDebt")
        if not s:
            s = self.series("DebtCurrent")
        return s

    @property
    def equity_series(self) -> list[tuple[str, float]]:
        return self.series("StockholdersEquity")

    @property
    def cash_series(self) -> list[tuple[str, float]]:
        s = self.series("CashAndCashEquivalentsAtCarryingValue")
        if not s:
            s = self.series("Cash")
        return s

    @property
    def capex_series(self) -> list[tuple[str, float]]:
        return self.series("PaymentsToAcquirePropertyPlantAndEquipment")

    @property
    def ocf_series(self) -> list[tuple[str, float]]:
        return self.series("NetCashProvidedByUsedInOperatingActivities")
