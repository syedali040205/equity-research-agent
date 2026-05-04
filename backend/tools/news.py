"""Recent news tool — reads from Postgres `news_articles` (ETL-populated)."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel

from core.config import settings
from db import query_cursor

from ._common import normalize_ticker


class NewsArticle(BaseModel):
    title: str
    summary: Optional[str] = None
    url: str
    source: str
    published_at: Optional[str] = None    # ISO 8601 string


class NewsResult(BaseModel):
    ticker: str
    days: int
    count: int
    articles: List[NewsArticle] = []
    error: Optional[str] = None


def get_recent_news(
    ticker: str,
    days: Optional[int] = None,
    limit: Optional[int] = None,
) -> NewsResult:
    norm = normalize_ticker(ticker)
    if not norm:
        return NewsResult(ticker=ticker or "", days=0, count=0, error="invalid ticker")

    days = days or settings.NEWS_LOOKBACK_DAYS
    limit = min(max(limit or settings.NEWS_DEFAULT_LIMIT, 1), 50)

    with query_cursor() as cur:
        cur.execute(
            """
            SELECT title, summary, url, source, published_at
            FROM news_articles
            WHERE ticker = %s
              AND (published_at IS NULL OR published_at > NOW() - (%s || ' days')::INTERVAL)
            ORDER BY COALESCE(published_at, ingested_at) DESC
            LIMIT %s
            """,
            (norm, str(days), limit),
        )
        rows = cur.fetchall()

    articles = [
        NewsArticle(
            title=r["title"],
            summary=r["summary"],
            url=r["url"],
            source=r["source"],
            published_at=r["published_at"].isoformat() if r["published_at"] else None,
        )
        for r in rows
    ]
    return NewsResult(ticker=norm, days=days, count=len(articles), articles=articles)
