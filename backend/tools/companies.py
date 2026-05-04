"""Company overview tool - reads from `companies` table."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from db import query_cursor
from tools._common import normalize_ticker


class CompanyOverview(BaseModel):
    ticker: str
    name: str
    sector: str
    industry: Optional[str] = None
    cik: Optional[str] = None
    exchange: Optional[str] = None
    error: Optional[str] = None


def get_company_overview(ticker: str) -> CompanyOverview:
    norm = normalize_ticker(ticker)
    if not norm:
        return CompanyOverview(ticker=ticker or "", name="", sector="", error="invalid ticker")

    with query_cursor() as cur:
        cur.execute(
            """
            SELECT ticker, name, sector, industry, cik, exchange
            FROM companies WHERE ticker = %s
            """,
            (norm,),
        )
        row = cur.fetchone()

    if not row:
        return CompanyOverview(ticker=norm, name="", sector="", error="ticker not in watchlist")

    return CompanyOverview(**row)
