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


@router.get("/news/{ticker}")
def news(
    ticker: str,
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=50),
):
    return get_recent_news(ticker, days=days, limit=limit).model_dump()


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
            WHERE published_at > NOW() - (%s || ' hours')::INTERVAL
            ORDER BY COALESCE(published_at, ingested_at) DESC
            LIMIT %s
            """,
            (str(hours), limit),
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


@router.get("/filings/{ticker}")
def filings(
    ticker: str,
    types: Optional[List[str]] = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    return get_recent_filings(ticker, types=types, limit=limit).model_dump()
