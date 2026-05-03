"""
News ingestion from Yahoo Finance per-ticker RSS feeds.

Why ETL this (vs. fetching on demand):
- RSS only returns the latest ~20 items. Without persistence we lose history.
- The agent needs 30 days of news context to answer "what's happened recently".
- Multiple agent runs on the same ticker reuse the same fetched data.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

import feedparser

from celery_app import app
from circuit_breaker import is_open
from config import settings
from db import cursor
from observability import track_run, log_skipped
from utils.validation import validate_news_article
from watchlist import all_tickers


YAHOO_RSS = "https://finance.yahoo.com/rss/headline?s={ticker}"


def _parse_pub(entry) -> Optional[datetime]:
    """feedparser exposes a parsed time tuple; convert to aware UTC datetime."""
    pp = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    if not pp:
        return None
    try:
        return datetime(*pp[:6], tzinfo=timezone.utc)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Per-ticker task
# ---------------------------------------------------------------------------

@app.task(
    name="tasks.news.fetch_for_ticker",
    bind=True,
    acks_late=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
    max_retries=2,
    time_limit=120,
)
def fetch_for_ticker(self, ticker: str) -> dict:
    pipeline = "news"

    if is_open(ticker, pipeline):
        log_skipped(pipeline, ticker, "circuit breaker open")
        return {"ticker": ticker, "status": "skipped", "reason": "circuit_open"}

    with track_run(pipeline=pipeline, ticker=ticker) as run:
        feed = feedparser.parse(YAHOO_RSS.format(ticker=ticker))
        # feedparser swallows HTTP errors into feed.bozo / feed.status — fail loud if structural error.
        if feed.bozo and not getattr(feed, "entries", None):
            raise RuntimeError(f"feed parse error: {feed.bozo_exception}")

        upserted = rejected = 0
        with cursor() as cur:
            for entry in feed.entries:
                row = {
                    "ticker": ticker,
                    "title": getattr(entry, "title", "").strip(),
                    "summary": getattr(entry, "summary", "").strip()[:4000] or None,
                    "url": getattr(entry, "link", "").strip(),
                    "source": "yahoo_finance_rss",
                    "published_at": _parse_pub(entry),
                }
                ok, err = validate_news_article(row)
                if not ok:
                    rejected += 1
                    continue

                cur.execute(
                    """
                    INSERT INTO news_articles
                        (ticker, title, summary, url, source, published_at)
                    VALUES (%(ticker)s, %(title)s, %(summary)s, %(url)s,
                            %(source)s, %(published_at)s)
                    ON CONFLICT (url) DO UPDATE SET
                        title        = EXCLUDED.title,
                        summary      = EXCLUDED.summary,
                        published_at = COALESCE(EXCLUDED.published_at, news_articles.published_at)
                    """,
                    row,
                )
                upserted += 1

        run.set(rows_upserted=upserted, rows_rejected=rejected,
                metadata={"feed_entries": len(feed.entries)})

    return {"ticker": ticker, "upserted": upserted, "rejected": rejected}


# ---------------------------------------------------------------------------
# Orchestrator: run for every ticker
# ---------------------------------------------------------------------------

@app.task(name="tasks.news.run_all", acks_late=True)
def run_all() -> dict:
    """Sequentially process every ticker. Failures don't block siblings."""
    results = {"success": 0, "failed": 0, "skipped": 0, "total_upserted": 0}
    for ticker in all_tickers():
        try:
            r = fetch_for_ticker.run(ticker)
            if r.get("status") == "skipped":
                results["skipped"] += 1
            else:
                results["success"] += 1
                results["total_upserted"] += r.get("upserted", 0)
        except Exception as exc:
            print(f"[news] {ticker} failed: {exc}")
            results["failed"] += 1
        time.sleep(settings.INTER_TICKER_SLEEP_MS / 1000)
    return results
