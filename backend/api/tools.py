"""HTTP endpoints exposing each tool — used for manual testing + agent debugging."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query

from tools import (
    compute_derived_metrics,
    get_company_overview,
    get_financials,
    get_price_snapshot,
    get_recent_filings,
    get_recent_news,
)

import requests as _requests

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("/prices")
def batch_prices(symbols: str = Query(..., description="Comma-separated ticker symbols")):
    """Batch price fetch via concurrent v8 chart calls — used by ticker tape."""
    import concurrent.futures

    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()][:20]
    if not tickers:
        return {"prices": []}

    def _fetch(sym: str) -> dict:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=2d"
        try:
            r = _requests.get(url, headers={"User-Agent": _UA}, timeout=8)
            r.raise_for_status()
            meta = r.json().get("chart", {}).get("result", [{}])[0].get("meta", {})
            price = meta.get("regularMarketPrice")
            prev = meta.get("chartPreviousClose") or meta.get("previousClose")
            pct = round((price - prev) / prev * 100, 2) if price and prev else None
            return {
                "ticker": sym,
                "price": round(price, 2) if price else None,
                "change_pct": pct,
            }
        except Exception as exc:
            return {"ticker": sym, "error": str(exc)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(_fetch, tickers))

    return {"prices": results}


@router.get("/history/{ticker}")
def price_history(
    ticker: str,
    range: str = Query("6mo", pattern="^(1mo|3mo|6mo|1y|2y|5y)$"),
):
    """OHLCV candlestick data for price chart."""
    norm = ticker.strip().upper()
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{norm}"
        f"?interval=1d&range={range}"
    )
    try:
        r = _requests.get(url, headers={"User-Agent": _UA}, timeout=12)
        r.raise_for_status()
        result = r.json().get("chart", {}).get("result", [{}])[0]
        meta = result.get("meta", {})
        timestamps = result.get("timestamp", [])
        quotes = result.get("indicators", {}).get("quote", [{}])[0]
        opens = quotes.get("open", [])
        highs = quotes.get("high", [])
        lows = quotes.get("low", [])
        closes = quotes.get("close", [])
        volumes = quotes.get("volume", [])

        bars = []
        for i, ts in enumerate(timestamps):
            c = closes[i] if i < len(closes) else None
            if c is None:
                continue
            bars.append({
                "date": ts * 1000,  # ms for JS Date
                "open": round(opens[i], 2) if i < len(opens) and opens[i] else None,
                "high": round(highs[i], 2) if i < len(highs) and highs[i] else None,
                "low": round(lows[i], 2) if i < len(lows) and lows[i] else None,
                "close": round(c, 2),
                "volume": volumes[i] if i < len(volumes) else None,
            })

        return {
            "ticker": norm,
            "name": meta.get("longName") or meta.get("shortName"),
            "currency": meta.get("currency"),
            "range": range,
            "bars": bars,
        }
    except Exception as exc:
        return {"ticker": norm, "error": str(exc), "bars": []}


@router.get("/financials-history/{ticker}")
def financials_history(ticker: str):
    """5-year revenue/net income/EPS trend for sparklines."""
    from tools import get_financials
    norm = ticker.strip().upper()
    fin = get_financials(norm, period_type="annual")
    return {
        "ticker": norm,
        "years": [
            {
                "year": (p.period_end or "")[:4],
                "revenue": p.revenue,
                "net_income": p.net_income,
                "gross_profit": p.gross_profit,
                "eps": p.eps_basic,
            }
            for p in reversed((fin.periods or [])[:5])
        ],
    }


@router.get("/company/{ticker}")
def company(ticker: str):
    return get_company_overview(ticker).model_dump()


@router.get("/price/{ticker}")
def price(ticker: str):
    return get_price_snapshot(ticker).model_dump()


@router.get("/financials/{ticker}")
def financials(
    ticker: str,
    period_type: str = Query("annual", pattern="^(annual|quarterly)$"),
):
    return get_financials(ticker, period_type=period_type).model_dump()


@router.get("/metrics/{ticker}")
def metrics(
    ticker: str,
    period_type: str = Query("annual", pattern="^(annual|quarterly)$"),
):
    fin = get_financials(ticker, period_type=period_type)
    return compute_derived_metrics(fin).model_dump()


@router.get("/news/live")
def news_live(
    limit: int = Query(30, ge=1, le=100),
    hours: int = Query(24, ge=1, le=168),
):
    """Recent news across all tickers — for the live sidebar."""
    from db import query_cursor
    with query_cursor() as cur:
        cur.execute(
            """
            SELECT ticker, title, summary, url, source, published_at
            FROM news_articles
            WHERE ingested_at > NOW() - (%s || ' hours')::INTERVAL
               OR (published_at IS NOT NULL AND published_at > NOW() - (%s || ' hours')::INTERVAL)
            ORDER BY COALESCE(published_at, ingested_at) DESC
            LIMIT %s
            """,
            (str(hours), str(hours), limit),
        )
        rows = cur.fetchall()

    if not rows:
        # Fallback: return most-recently ingested articles regardless of age
        with query_cursor() as cur:
            cur.execute(
                """
                SELECT ticker, title, summary, url, source, published_at
                FROM news_articles
                ORDER BY COALESCE(ingested_at, published_at) DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
    return {
        "count": len(rows),
        "articles": [
            {
                "ticker": r["ticker"],
                "title": r["title"],
                "url": r["url"],
                "source": r["source"],
                "published_at": r["published_at"].isoformat() if r["published_at"] else None,
            }
            for r in rows
        ],
    }


@router.get("/news/{ticker}")
def news(
    ticker: str,
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=50),
):
    return get_recent_news(ticker, days=days, limit=limit).model_dump()


_PEERS: dict[str, list[str]] = {
    "AAPL": ["MSFT", "GOOGL", "META", "AMZN"],
    "MSFT": ["AAPL", "GOOGL", "AMZN", "CRM", "ORCL"],
    "NVDA": ["AMD", "INTC", "QCOM", "AVGO", "TSM"],
    "GOOGL": ["META", "MSFT", "AAPL", "AMZN", "SNAP"],
    "GOOG": ["META", "MSFT", "AAPL", "AMZN", "SNAP"],
    "AMZN": ["MSFT", "GOOGL", "SHOP", "WMT", "BABA"],
    "META": ["GOOGL", "SNAP", "PINS", "RDDT", "TIKTOK"],
    "TSLA": ["RIVN", "NIO", "F", "GM", "LCID"],
    "JPM": ["BAC", "GS", "MS", "WFC", "C"],
    "BAC": ["JPM", "WFC", "GS", "MS", "C"],
    "GS": ["MS", "JPM", "BAC", "BLK", "C"],
    "XOM": ["CVX", "COP", "BP", "SHEL", "TTE"],
    "CVX": ["XOM", "COP", "BP", "SHEL", "PSX"],
    "UNH": ["CVS", "CI", "HUM", "ELV", "MOH"],
    "JNJ": ["PFE", "MRK", "ABBV", "LLY", "BMY"],
    "PFE": ["JNJ", "MRK", "ABBV", "LLY", "GILD"],
    "V": ["MA", "AXP", "PYPL", "SQ", "FIS"],
    "MA": ["V", "AXP", "PYPL", "SQ", "FIS"],
    "WMT": ["AMZN", "TGT", "COST", "KR", "HD"],
    "HD": ["LOW", "WMT", "TGT", "COST", "TSCO"],
    "DIS": ["NFLX", "PARA", "WBD", "CMCSA", "SONY"],
    "NFLX": ["DIS", "PARA", "WBD", "AMZN", "AAPL"],
    "BRK.B": ["JPM", "BAC", "GS", "AIG", "PRU"],
    "AMD": ["NVDA", "INTC", "QCOM", "AVGO", "ARM"],
    "INTC": ["AMD", "NVDA", "QCOM", "TSM", "AVGO"],
    "CRM": ["MSFT", "SAP", "ORCL", "NOW", "WDAY"],
    "PYPL": ["V", "MA", "SQ", "SHOP", "AFRM"],
    "SPOT": ["AAPL", "AMZN", "GOOGL", "TIDAL", "DEEZER"],
    "UBER": ["LYFT", "DASH", "ABNB", "GRAB", "DIDI"],
    "ABNB": ["BKNG", "EXPE", "UBER", "LYFT", "TRIP"],
}


@router.get("/peers/{ticker}")
def peer_comparison(ticker: str):
    """Return price snapshots for the ticker and its sector peers."""
    norm = ticker.strip().upper()
    peers = _PEERS.get(norm, [])

    def _fetch(sym: str) -> dict:
        try:
            snap = get_price_snapshot(sym)
            if snap.error:
                return {"ticker": sym, "error": snap.error}
            price = snap.current_price
            prev = snap.previous_close
            chg_pct = round((price - prev) / prev * 100, 2) if price and prev else None
            w52h = snap.week_52_high
            w52l = snap.week_52_low
            chg_52w = round((price - w52l) / w52l * 100, 1) if price and w52l else None
            return {
                "ticker": sym,
                "name": snap.name or sym,
                "price": round(price, 2) if price else None,
                "change_pct": chg_pct,
                "week_52_high": round(w52h, 2) if w52h else None,
                "week_52_low": round(w52l, 2) if w52l else None,
                "change_from_52w_low_pct": chg_52w,
                "pe_ratio": snap.pe_ratio,
                "market_cap": snap.market_cap,
            }
        except Exception as exc:
            return {"ticker": sym, "error": str(exc)}

    import concurrent.futures
    all_tickers = [norm] + peers
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(_fetch, all_tickers))

    return {"ticker": norm, "peers": peers, "data": results}


@router.get("/filings/{ticker}")
def filings(
    ticker: str,
    types: Optional[List[str]] = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    return get_recent_filings(ticker, types=types, limit=limit).model_dump()
