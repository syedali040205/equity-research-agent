"""
Postgres connection + idempotent schema initialization.

Run standalone:
    python -m db init     # create tables
    python -m db migrate  # alias of init (CREATE IF NOT EXISTS is idempotent)
    python -m db status   # quick health check
"""
from __future__ import annotations

import sys
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

from config import settings


# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def connect():
    """Return a fresh psycopg2 connection. Caller is responsible for closing."""
    return psycopg2.connect(settings.DATABASE_URL)


@contextmanager
def cursor(dict_rows: bool = False):
    """Context manager: yields a cursor in a transaction. Commits on success, rolls back on error."""
    conn = connect()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor) if dict_rows else conn.cursor()
        try:
            yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Schema (CREATE IF NOT EXISTS — idempotent migration)
# ---------------------------------------------------------------------------

SCHEMA_SQL = r"""
-- Master watchlist of companies the system tracks.
CREATE TABLE IF NOT EXISTS companies (
    ticker        VARCHAR(12) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    sector        VARCHAR(64)  NOT NULL,
    industry      VARCHAR(128),
    cik           VARCHAR(10),                          -- SEC EDGAR Central Index Key (zero-padded 10 digits)
    exchange      VARCHAR(32),
    source        VARCHAR(32)  NOT NULL DEFAULT 'manual',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_companies_sector ON companies (sector);
CREATE INDEX IF NOT EXISTS ix_companies_cik    ON companies (cik);


-- News articles ingested from RSS feeds. URL is the natural key (dedupes across sources).
CREATE TABLE IF NOT EXISTS news_articles (
    id            BIGSERIAL    PRIMARY KEY,
    ticker        VARCHAR(12)  NOT NULL REFERENCES companies(ticker) ON DELETE CASCADE,
    title         TEXT         NOT NULL,
    summary       TEXT,
    url           TEXT         NOT NULL UNIQUE,
    source        VARCHAR(64)  NOT NULL,                -- e.g. 'yahoo_finance_rss'
    published_at  TIMESTAMPTZ,
    ingested_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_news_ticker_published
    ON news_articles (ticker, published_at DESC);


-- SEC EDGAR filings metadata. Accession number is the natural key.
CREATE TABLE IF NOT EXISTS sec_filings (
    id                BIGSERIAL    PRIMARY KEY,
    ticker            VARCHAR(12)  NOT NULL REFERENCES companies(ticker) ON DELETE CASCADE,
    cik               VARCHAR(10)  NOT NULL,
    accession_number  VARCHAR(32)  NOT NULL UNIQUE,
    filing_type       VARCHAR(16)  NOT NULL,            -- '10-K', '10-Q', '8-K', etc.
    filed_at          DATE         NOT NULL,
    period_of_report  DATE,
    primary_doc_url   TEXT,
    filing_index_url  TEXT,
    items             TEXT,                             -- e.g. '1A.Risk Factors,7.MDA'
    source            VARCHAR(32)  NOT NULL DEFAULT 'edgar',
    ingested_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_filings_ticker_date
    ON sec_filings (ticker, filed_at DESC);
CREATE INDEX IF NOT EXISTS ix_filings_type
    ON sec_filings (filing_type);


-- Observability: every pipeline run is logged here.
-- This table IS our dead-letter queue + lineage + metrics surface.
CREATE TABLE IF NOT EXISTS etl_runs (
    id              BIGSERIAL    PRIMARY KEY,
    run_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    pipeline        VARCHAR(32)  NOT NULL,              -- 'companies' | 'news' | 'filings' | 'pipeline'
    ticker          VARCHAR(12),                        -- NULL for pipeline-level rollups
    status          VARCHAR(16)  NOT NULL,              -- 'success' | 'failed' | 'skipped' | 'partial'
    rows_upserted   INTEGER      NOT NULL DEFAULT 0,
    rows_rejected   INTEGER      NOT NULL DEFAULT 0,
    duration_ms     INTEGER,
    error           TEXT,
    metadata        JSONB
);

CREATE INDEX IF NOT EXISTS ix_etl_runs_pipeline_time
    ON etl_runs (pipeline, run_at DESC);
CREATE INDEX IF NOT EXISTS ix_etl_runs_ticker_time
    ON etl_runs (ticker, run_at DESC);
CREATE INDEX IF NOT EXISTS ix_etl_runs_status_time
    ON etl_runs (status, run_at DESC);


-- Agent observability: one row per LLM call inside the multi-agent graph.
CREATE TABLE IF NOT EXISTS agent_runs (
    id              BIGSERIAL    PRIMARY KEY,
    run_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    research_id     UUID         NOT NULL,             -- groups all calls for one brief
    ticker          VARCHAR(12),
    node            VARCHAR(32)  NOT NULL,             -- 'analyst' | 'critic' | 'writer' | 'researcher_*'
    model           VARCHAR(64),
    success         BOOLEAN      NOT NULL DEFAULT TRUE,
    duration_ms     INTEGER,
    prompt_tokens   INTEGER,
    completion_tokens INTEGER,
    retry_count     INTEGER      NOT NULL DEFAULT 0,
    error           TEXT,
    metadata        JSONB
);

CREATE INDEX IF NOT EXISTS ix_agent_runs_research ON agent_runs (research_id);
CREATE INDEX IF NOT EXISTS ix_agent_runs_ticker_time ON agent_runs (ticker, run_at DESC);


-- Generated briefs (the final output of one full agent run).
CREATE TABLE IF NOT EXISTS briefs (
    id              UUID         PRIMARY KEY,
    ticker          VARCHAR(12)  NOT NULL,
    generated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    model           VARCHAR(64),
    duration_ms     INTEGER,
    retry_count     INTEGER      NOT NULL DEFAULT 0,
    confidence      NUMERIC(5,2),
    sources_cited   INTEGER,
    brief           JSONB        NOT NULL,             -- full structured brief
    raw_state       JSONB                              -- final ResearchState (for replay/debug)
);

CREATE INDEX IF NOT EXISTS ix_briefs_ticker_time ON briefs (ticker, generated_at DESC);
"""


def init_schema() -> None:
    """Create tables if they don't exist. Safe to run any number of times."""
    with cursor() as cur:
        cur.execute(SCHEMA_SQL)
    print("[db] schema initialized")


def status() -> dict:
    """Quick health check + row counts."""
    out: dict = {}
    with cursor(dict_rows=True) as cur:
        cur.execute("SELECT version()")
        out["postgres"] = cur.fetchone()["version"].split(",")[0]

        for table in ("companies", "news_articles", "sec_filings", "etl_runs",
                      "agent_runs", "briefs"):
            cur.execute(f"SELECT COUNT(*) AS n FROM {table}")
            out[table] = cur.fetchone()["n"]
    return out


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd in ("init", "migrate"):
        init_schema()
    elif cmd == "status":
        print(status())
    else:
        print(f"Unknown command: {cmd}. Use init|migrate|status.")
        sys.exit(1)
