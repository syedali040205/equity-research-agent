"""Price snapshot tool — Yahoo Finance v8 chart (reliable in Docker) + v10 crumb for valuations."""
from __future__ import annotations

from typing import Optional

import requests
from pydantic import BaseModel

from ._common import normalize_ticker, safe_float, safe_int

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
_CONSENT_URL = "https://finance.yahoo.com/"
_CRUMB_URL = "https://query1.finance.yahoo.com/v1/test/getcrumb"
_V10_URL = (
    "https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}"
    "?modules=price,summaryDetail,defaultKeyStatistics&crumb={crumb}"
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

    # --- Primary: v8 chart — always works in Docker, has OHLCV + 52w + name ---
    try:
        r = sess.get(_CHART_URL.format(ticker=norm), timeout=12)
        r.raise_for_status()
        meta = r.json().get("chart", {}).get("result", [{}])[0].get("meta", {})
        current = safe_float(meta.get("regularMarketPrice"))
        prev = safe_float(meta.get("chartPreviousClose") or meta.get("previousClose"))

        # Get today's open from last bar in indicators
        chart_result = r.json().get("chart", {}).get("result", [{}])[0]
        indicators = chart_result.get("indicators", {}).get("quote", [{}])[0]
        opens = indicators.get("open") or []
        today_open = safe_float(opens[-1]) if opens else None

        snap = PriceSnapshot(
            ticker=norm,
            name=meta.get("longName") or meta.get("shortName"),
            currency=meta.get("currency"),
            current_price=current,
            previous_close=prev,
            open=today_open,
            change_pct_1d=_change_pct(current, prev),
            day_high=safe_float(meta.get("regularMarketDayHigh")),
            day_low=safe_float(meta.get("regularMarketDayLow")),
            week_52_high=safe_float(meta.get("fiftyTwoWeekHigh")),
            week_52_low=safe_float(meta.get("fiftyTwoWeekLow")),
            volume=safe_int(meta.get("regularMarketVolume")),
        )
    except Exception as exc:
        return PriceSnapshot(ticker=norm, error=str(exc))

    # --- Enrichment: v10 with crumb for pe_ratio, market_cap, beta, dividend ---
    try:
        sess.get(_CONSENT_URL, timeout=8)
        cr = sess.get(_CRUMB_URL, timeout=8)
        crumb = cr.text.strip() if cr.status_code == 200 and cr.text.strip() else None
        if crumb:
            r2 = sess.get(_V10_URL.format(ticker=norm, crumb=crumb), timeout=12)
            if r2.status_code == 200:
                result = r2.json().get("quoteSummary", {}).get("result") or []
                if result:
                    price_mod = result[0].get("price", {})
                    detail = result[0].get("summaryDetail", {})
                    stats = result[0].get("defaultKeyStatistics", {})

                    def raw(d: dict, key: str):
                        v = d.get(key)
                        return v.get("raw") if isinstance(v, dict) else v

                    snap.market_cap = safe_int(raw(price_mod, "marketCap"))
                    snap.avg_volume = safe_int(raw(detail, "averageVolume"))
                    snap.pe_ratio = safe_float(raw(detail, "trailingPE"))
                    snap.forward_pe = safe_float(raw(detail, "forwardPE"))
                    snap.eps = safe_float(raw(price_mod, "epsTrailingTwelveMonths"))
                    snap.pb_ratio = safe_float(raw(stats, "priceToBook"))
                    snap.dividend_yield = safe_float(raw(detail, "dividendYield"))
                    snap.beta = safe_float(raw(detail, "beta"))
                    if not snap.name:
                        snap.name = price_mod.get("longName") or price_mod.get("shortName")
    except Exception:
        pass  # enrichment is best-effort — snap already has the core data

    return snap
