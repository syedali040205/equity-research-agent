"""Recent SEC filings tool — reads from Postgres `sec_filings` (ETL-populated)."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel

from core.config import settings
from db import query_cursor

from ._common import normalize_ticker


class Filing(BaseModel):
    accession_number: str
    filing_type: str
    filed_at: str                         # ISO date
    period_of_report: Optional[str] = None
    primary_doc_url: Optional[str] = None
    filing_index_url: Optional[str] = None
    items: Optional[str] = None


class FilingsResult(BaseModel):
    ticker: str
    count: int
    filings: List[Filing] = []
    error: Optional[str] = None


def get_recent_filings(
    ticker: str,
    types: Optional[List[str]] = None,
    limit: Optional[int] = None,
) -> FilingsResult:
    norm = normalize_ticker(ticker)
    if not norm:
        return FilingsResult(ticker=ticker or "", count=0, error="invalid ticker")

    limit = min(max(limit or settings.FILINGS_DEFAULT_LIMIT, 1), 50)
    type_filter = [t.strip().upper() for t in (types or []) if t]

    sql = """
        SELECT accession_number, filing_type, filed_at, period_of_report,
               primary_doc_url, filing_index_url, items
        FROM sec_filings
        WHERE ticker = %s
    """
    params: list = [norm]
    if type_filter:
        sql += " AND filing_type = ANY(%s)"
        params.append(type_filter)
    sql += " ORDER BY filed_at DESC LIMIT %s"
    params.append(limit)

    with query_cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    filings = [
        Filing(
            accession_number=r["accession_number"],
            filing_type=r["filing_type"],
            filed_at=r["filed_at"].isoformat() if r["filed_at"] else "",
            period_of_report=r["period_of_report"].isoformat() if r["period_of_report"] else None,
            primary_doc_url=r["primary_doc_url"],
            filing_index_url=r["filing_index_url"],
            items=r["items"],
        )
        for r in rows
    ]
    return FilingsResult(ticker=norm, count=len(filings), filings=filings)
