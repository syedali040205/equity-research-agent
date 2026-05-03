"""Schema + business-rule validation. Pure functions, easily unit-tested."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


VALID_FILING_TYPES = {"10-K", "10-Q", "8-K", "10-K/A", "10-Q/A", "S-1", "DEF 14A"}


def _is_url(s: Optional[str]) -> bool:
    return bool(s) and isinstance(s, str) and (s.startswith("http://") or s.startswith("https://"))


def validate_news_article(row: dict) -> tuple[bool, Optional[str]]:
    """Return (ok, error_message). row is the candidate news_articles record."""
    if not row.get("ticker"):
        return False, "missing ticker"
    if not row.get("title") or not str(row["title"]).strip():
        return False, "empty title"
    if not _is_url(row.get("url")):
        return False, "invalid url"
    if not row.get("source"):
        return False, "missing source"

    pub = row.get("published_at")
    if pub is not None:
        if not isinstance(pub, datetime):
            return False, "published_at must be datetime"
        # Reject articles from the future (clock skew or bad data)
        if pub > datetime.now(tz=timezone.utc):
            return False, "published_at is in the future"
    return True, None


def validate_sec_filing(row: dict) -> tuple[bool, Optional[str]]:
    """Return (ok, error_message)."""
    if not row.get("ticker"):
        return False, "missing ticker"
    if not row.get("cik"):
        return False, "missing cik"
    if not row.get("accession_number"):
        return False, "missing accession_number"
    if row.get("filing_type") not in VALID_FILING_TYPES:
        return False, f"unsupported filing_type {row.get('filing_type')}"

    filed = row.get("filed_at")
    if filed is None:
        return False, "missing filed_at"
    if hasattr(filed, "year") and filed.year < 1995:
        return False, "filed_at too old (likely parse error)"
    return True, None


def validate_company(row: dict) -> tuple[bool, Optional[str]]:
    if not row.get("ticker"):
        return False, "missing ticker"
    if not row.get("name"):
        return False, "missing name"
    if not row.get("sector"):
        return False, "missing sector"
    return True, None
