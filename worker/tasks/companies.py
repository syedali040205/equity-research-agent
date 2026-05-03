"""
Bootstrap & maintain the `companies` table.

Two responsibilities:
1. Seed the watchlist into Postgres on first run.
2. Resolve each ticker's CIK from the SEC ticker→CIK mapping (one-time per company),
   so the filings pipeline can query EDGAR.
"""
from __future__ import annotations

import time
from typing import Dict

from celery_app import app
from config import settings
from db import cursor
from observability import track_run, log_etl_run
from utils.http import sec_get
from utils.validation import validate_company
from watchlist import COMPANY_META, all_tickers


SEC_TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json"


def _fetch_ticker_to_cik() -> Dict[str, str]:
    """
    Fetch SEC's master ticker→CIK mapping. Returns {TICKER: '0000320193', ...}.
    The endpoint returns rows like {"cik_str": 320193, "ticker": "AAPL", ...}.
    """
    resp = sec_get(SEC_TICKER_MAP_URL)
    raw = resp.json()
    out: Dict[str, str] = {}
    for entry in raw.values():
        ticker = str(entry.get("ticker", "")).upper()
        cik = entry.get("cik_str")
        if ticker and cik is not None:
            # SEC EDGAR APIs require zero-padded 10-digit CIK
            out[ticker] = str(cik).zfill(10)
    return out


@app.task(
    name="tasks.companies.bootstrap_companies",
    bind=True,
    acks_late=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
    max_retries=3,
)
def bootstrap_companies(self) -> dict:
    """
    Idempotent upsert of the watchlist into `companies`, including SEC CIKs.
    Safe to run any number of times — uses ON CONFLICT.
    """
    pipeline = "companies"
    upserted = rejected = 0

    # Be defensive: even if SEC is down, we can still seed metadata without CIKs.
    try:
        ticker_to_cik = _fetch_ticker_to_cik()
    except Exception as exc:
        ticker_to_cik = {}
        print(f"[companies] SEC ticker map unreachable, proceeding without CIKs: {exc}")

    with track_run(pipeline=pipeline, metadata={"watchlist_size": len(COMPANY_META)}) as run:
        with cursor() as cur:
            for ticker, (name, sector, industry) in COMPANY_META.items():
                # SEC uses 'BRK.B' style, our list uses 'BRK-B' — normalize both ways
                lookup_keys = {ticker.upper(), ticker.replace("-", ".").upper()}
                cik = next((ticker_to_cik[k] for k in lookup_keys if k in ticker_to_cik), None)

                row = {
                    "ticker": ticker,
                    "name": name,
                    "sector": sector,
                    "industry": industry,
                    "cik": cik,
                    "exchange": None,
                    "source": "watchlist",
                }
                ok, err = validate_company(row)
                if not ok:
                    rejected += 1
                    print(f"[companies] reject {ticker}: {err}")
                    continue

                cur.execute(
                    """
                    INSERT INTO companies
                        (ticker, name, sector, industry, cik, exchange, source, updated_at)
                    VALUES (%(ticker)s, %(name)s, %(sector)s, %(industry)s,
                            %(cik)s, %(exchange)s, %(source)s, NOW())
                    ON CONFLICT (ticker) DO UPDATE SET
                        name      = EXCLUDED.name,
                        sector    = EXCLUDED.sector,
                        industry  = EXCLUDED.industry,
                        cik       = COALESCE(EXCLUDED.cik, companies.cik),
                        updated_at= NOW()
                    """,
                    row,
                )
                upserted += 1

        run.set(
            rows_upserted=upserted,
            rows_rejected=rejected,
            metadata={
                "watchlist_size": len(COMPANY_META),
                "ciks_resolved": sum(1 for t in COMPANY_META if ticker_to_cik.get(t)),
            },
        )

    return {"upserted": upserted, "rejected": rejected}
