"""Price snapshot tool — Yahoo Finance v8 chart + SEC EDGAR for fundamentals."""
from __future__ import annotations

from typing import Optional

import requests
from pydantic import BaseModel

from ._common import normalize_ticker, safe_float, safe_int
from .edgar import EdgarFundamentals, ticker_to_cik

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d"


class PriceSnapshot(BaseModel):
    ticker: str
    name: Optional[str] = None
    currency: Optional[str] = None
    current_price: Optional[float] = None
    previous_close: Optional[float] = None
    open: Optional[float] = None
    day_high: Optional[float] = None
    day_low: Optional[float] = None
    change_pct_1d: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None
    market_cap: Optional[int] = None
    volume: Optional[int] = None
    avg_volume: Optional[int] = None
    pe_ratio: Optional[float] = None
    forward_pe: Optional[float] = None
    eps: Optional[float] = None
    pb_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None
    beta: Optional[float] = None
    error: Optional[str] = None


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": _UA, "Accept": "application/json"})
    return s


def _change_pct(current: Optional[float], prev: Optional[float]) -> Optional[float]:
    if current is not None and prev not in (None, 0):
        return round((current - prev) / prev * 100, 2)
    return None


def get_price_snapshot(ticker: str) -> PriceSnapshot:
    norm = normalize_ticker(ticker)
    if not norm:
        return PriceSnapshot(ticker=ticker or "", error="invalid ticker")

    sess = _session()

    # --- Primary: v8 chart — OHLCV + 52w ---
    try:
        r = sess.get(_CHART_URL.format(ticker=norm), timeout=12)
        r.raise_for_status()
        chart_result = r.json().get("chart", {}).get("result", [{}])[0]
        meta = chart_result.get("meta", {})
        current = safe_float(meta.get("regularMarketPrice"))
        prev = safe_float(meta.get("chartPreviousClose") or meta.get("previousClose"))
        opens = chart_result.get("indicators", {}).get("quote", [{}])[0].get("open") or []

        snap = PriceSnapshot(
            ticker=norm,
            name=meta.get("longName") or meta.get("shortName"),
            currency=meta.get("currency"),
            current_price=current,
            previous_close=prev,
            open=safe_float(opens[-1]) if opens else None,
            change_pct_1d=_change_pct(current, prev),
            day_high=safe_float(meta.get("regularMarketDayHigh")),
            day_low=safe_float(meta.get("regularMarketDayLow")),
            week_52_high=safe_float(meta.get("fiftyTwoWeekHigh")),
            week_52_low=safe_float(meta.get("fiftyTwoWeekLow")),
            volume=safe_int(meta.get("regularMarketVolume")),
            # v8 chart meta sometimes includes these for certain quote types
            market_cap=safe_int(meta.get("marketCap")),
            pe_ratio=safe_float(meta.get("trailingPE")),
            eps=safe_float(meta.get("epsTrailingTwelveMonths")),
        )
    except Exception as exc:
        return PriceSnapshot(ticker=norm, error=str(exc))

    # --- Enrichment: SEC EDGAR XBRL (no auth, works from Docker) ---
    try:
        cik = ticker_to_cik(norm)
        if cik:
            edgar = EdgarFundamentals(cik)
            # EPS from EDGAR (trailing twelve months annual)
            if snap.eps is None:
                eps_series = edgar.eps_series
                if eps_series:
                    snap.eps = eps_series[0][1]
            # Market cap = price × shares outstanding
            if snap.market_cap is None and snap.current_price:
                shares = edgar.shares_outstanding
                if shares:
                    snap.market_cap = safe_int(snap.current_price * shares)
            # PE = price / EPS
            if snap.pe_ratio is None and snap.current_price and snap.eps and snap.eps != 0:
                snap.pe_ratio = round(snap.current_price / snap.eps, 2)
    except Exception:
        pass

    return snap
