"""Unit tests for validation rules. Pure functions, no DB needed."""
from datetime import datetime, timedelta, timezone

import pytest

from utils.validation import (
    validate_company,
    validate_news_article,
    validate_sec_filing,
)


# ---------------------------------------------------------------------------
# News
# ---------------------------------------------------------------------------

def test_news_valid():
    ok, err = validate_news_article({
        "ticker": "AAPL",
        "title": "Apple announces something",
        "url": "https://example.com/article",
        "source": "yahoo_finance_rss",
        "published_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    })
    assert ok and err is None


def test_news_missing_title():
    ok, err = validate_news_article({
        "ticker": "AAPL",
        "title": "   ",
        "url": "https://example.com/x",
        "source": "rss",
    })
    assert not ok and "title" in err


def test_news_invalid_url():
    ok, err = validate_news_article({
        "ticker": "AAPL",
        "title": "ok",
        "url": "not-a-url",
        "source": "rss",
    })
    assert not ok and "url" in err


def test_news_future_date_rejected():
    future = datetime.now(tz=timezone.utc) + timedelta(days=2)
    ok, err = validate_news_article({
        "ticker": "AAPL",
        "title": "ok",
        "url": "https://example.com/x",
        "source": "rss",
        "published_at": future,
    })
    assert not ok and "future" in err


# ---------------------------------------------------------------------------
# SEC filings
# ---------------------------------------------------------------------------

def test_filing_valid():
    ok, err = validate_sec_filing({
        "ticker": "AAPL",
        "cik": "0000320193",
        "accession_number": "0000320193-24-000001",
        "filing_type": "10-K",
        "filed_at": datetime(2024, 11, 1).date(),
    })
    assert ok and err is None


def test_filing_unsupported_type():
    ok, err = validate_sec_filing({
        "ticker": "AAPL",
        "cik": "0000320193",
        "accession_number": "x",
        "filing_type": "FAKE",
        "filed_at": datetime(2024, 1, 1).date(),
    })
    assert not ok


def test_filing_missing_cik():
    ok, err = validate_sec_filing({
        "ticker": "AAPL",
        "accession_number": "x",
        "filing_type": "10-K",
        "filed_at": datetime(2024, 1, 1).date(),
    })
    assert not ok and "cik" in err


# ---------------------------------------------------------------------------
# Company
# ---------------------------------------------------------------------------

def test_company_valid():
    ok, _ = validate_company({"ticker": "AAPL", "name": "Apple", "sector": "tech"})
    assert ok


def test_company_missing_sector():
    ok, err = validate_company({"ticker": "AAPL", "name": "Apple"})
    assert not ok and "sector" in err
