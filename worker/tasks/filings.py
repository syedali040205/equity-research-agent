"""
SEC EDGAR filings ingestion.

Why ETL this (vs. fetching on demand):
- EDGAR is slow (~2-3s per request) and rate-limited (10 req/sec).
- Pre-fetching filing metadata lets the agent answer "what was the latest 10-K"
  without round-tripping to SEC every time.
- We store metadata + URLs; full-text extraction is on-demand later.
"""
from __future__ import annotations

import time
from datetime import date, datetime
from typing import Optional

from celery_app import app
from circuit_breaker import is_open
from config import settings
from db import cursor
from observability import track_run, log_skipped
from utils.http import sec_get
from utils.validation import validate_sec_filing, VALID_FILING_TYPES
from watchlist import all_tickers


SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
FILING_INDEX_URL = (
    "https://www.sec.gov/cgi-bin/browse-edgar?"
    "action=getcompany&CIK={cik}&type={ftype}&dateb=&owner=include&count=10"
)
ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik_int}/{accession_clean}/"


def _parse_date(s: str) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        return None


def _get_cik(ticker: str) -> Optional[str]:
    with cursor() as cur:
        cur.execute("SELECT cik FROM companies WHERE ticker = %s", (ticker,))
        row = cur.fetchone()
    return row[0] if row and row[0] else None


# ---------------------------------------------------------------------------
# Per-ticker task
# ---------------------------------------------------------------------------

@app.task(
    name="tasks.filings.fetch_for_ticker",
    bind=True,
    acks_late=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
    max_retries=2,
    time_limit=180,
)
def fetch_for_ticker(self, ticker: str) -> dict:
    pipeline = "filings"

    if is_open(ticker, pipeline):
        log_skipped(pipeline, ticker, "circuit breaker open")
        return {"ticker": ticker, "status": "skipped", "reason": "circuit_open"}

    cik = _get_cik(ticker)
    if not cik:
        log_skipped(pipeline, ticker, "no CIK on file (run companies pipeline first)")
        return {"ticker": ticker, "status": "skipped", "reason": "no_cik"}

    with track_run(pipeline=pipeline, ticker=ticker, metadata={"cik": cik}) as run:
        resp = sec_get(SUBMISSIONS_URL.format(cik=cik))
        data = resp.json()

        recent = (data.get("filings") or {}).get("recent") or {}
        # Each list is column-oriented and same-length
        accession   = recent.get("accessionNumber", []) or []
        form_types  = recent.get("form", []) or []
        filed_dates = recent.get("filingDate", []) or []
        report_dates = recent.get("reportDate", []) or []
        primary_docs = recent.get("primaryDocument", []) or []
        items_list   = recent.get("items", []) or []

        upserted = rejected = 0
        with cursor() as cur:
            for i in range(len(accession)):
                ftype = form_types[i] if i < len(form_types) else ""
                if ftype not in VALID_FILING_TYPES:
                    continue  # skip filings we don't care about (8-K/A noise, NT-10K, etc.)

                acc = accession[i]
                acc_clean = acc.replace("-", "")
                primary = primary_docs[i] if i < len(primary_docs) else ""
                items = items_list[i] if i < len(items_list) else None

                row = {
                    "ticker": ticker,
                    "cik": cik,
                    "accession_number": acc,
                    "filing_type": ftype,
                    "filed_at": _parse_date(filed_dates[i] if i < len(filed_dates) else ""),
                    "period_of_report": _parse_date(report_dates[i] if i < len(report_dates) else ""),
                    "primary_doc_url": (
                        ARCHIVE_URL.format(cik_int=int(cik), accession_clean=acc_clean) + primary
                        if primary else None
                    ),
                    "filing_index_url": (
                        ARCHIVE_URL.format(cik_int=int(cik), accession_clean=acc_clean)
                        + acc + "-index.html"
                    ),
                    "items": items if items else None,
                }
                ok, err = validate_sec_filing(row)
                if not ok:
                    rejected += 1
                    continue

                cur.execute(
                    """
                    INSERT INTO sec_filings
                        (ticker, cik, accession_number, filing_type, filed_at,
                         period_of_report, primary_doc_url, filing_index_url, items)
                    VALUES (%(ticker)s, %(cik)s, %(accession_number)s, %(filing_type)s,
                            %(filed_at)s, %(period_of_report)s, %(primary_doc_url)s,
                            %(filing_index_url)s, %(items)s)
                    ON CONFLICT (accession_number) DO UPDATE SET
                        primary_doc_url  = EXCLUDED.primary_doc_url,
                        filing_index_url = EXCLUDED.filing_index_url,
                        items            = COALESCE(EXCLUDED.items, sec_filings.items)
                    """,
                    row,
                )
                upserted += 1

        run.set(
            rows_upserted=upserted,
            rows_rejected=rejected,
            metadata={"cik": cik, "feed_entries": len(accession)},
        )

    return {"ticker": ticker, "upserted": upserted, "rejected": rejected}


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

@app.task(name="tasks.filings.run_all", acks_late=True)
def run_all() -> dict:
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
            print(f"[filings] {ticker} failed: {exc}")
            results["failed"] += 1
        # SEC EDGAR rate-limit pad (in addition to per-request sleep in sec_get)
        time.sleep(settings.SEC_RATE_LIMIT_MS / 1000)
    return results
