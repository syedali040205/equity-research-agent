"""Centralized helpers for logging ETL runs and reading pipeline health."""
from __future__ import annotations

import json
import time
from contextlib import contextmanager
from typing import Optional

from db import cursor


def log_etl_run(
    *,
    pipeline: str,
    ticker: Optional[str],
    status: str,
    rows_upserted: int = 0,
    rows_rejected: int = 0,
    duration_ms: Optional[int] = None,
    error: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> int:
    """Insert one row into etl_runs. Returns the row id."""
    with cursor() as cur:
        cur.execute(
            """
            INSERT INTO etl_runs
                (pipeline, ticker, status, rows_upserted, rows_rejected,
                 duration_ms, error, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            RETURNING id
            """,
            (
                pipeline,
                ticker,
                status,
                rows_upserted,
                rows_rejected,
                duration_ms,
                error[:4000] if error else None,
                json.dumps(metadata) if metadata else None,
            ),
        )
        return cur.fetchone()[0]


@contextmanager
def track_run(*, pipeline: str, ticker: Optional[str] = None, metadata: Optional[dict] = None):
    """
    Context manager that times a unit of work and writes one etl_runs row.

    Usage:
        with track_run(pipeline="news", ticker="AAPL") as run:
            run.set(rows_upserted=12)
            ...

    On exception: status='failed', error=str(exc), and the exception is re-raised.
    """
    start = time.perf_counter()
    state = {"rows_upserted": 0, "rows_rejected": 0, "metadata": metadata or {}}

    class _Run:
        def set(self, **kw):
            state.update(kw)

    run = _Run()
    try:
        yield run
    except Exception as exc:
        elapsed = int((time.perf_counter() - start) * 1000)
        log_etl_run(
            pipeline=pipeline,
            ticker=ticker,
            status="failed",
            rows_upserted=state["rows_upserted"],
            rows_rejected=state["rows_rejected"],
            duration_ms=elapsed,
            error=f"{type(exc).__name__}: {exc}",
            metadata=state["metadata"],
        )
        raise
    else:
        elapsed = int((time.perf_counter() - start) * 1000)
        log_etl_run(
            pipeline=pipeline,
            ticker=ticker,
            status="success",
            rows_upserted=state["rows_upserted"],
            rows_rejected=state["rows_rejected"],
            duration_ms=elapsed,
            metadata=state["metadata"],
        )


def log_skipped(pipeline: str, ticker: str, reason: str) -> None:
    log_etl_run(
        pipeline=pipeline,
        ticker=ticker,
        status="skipped",
        error=reason,
    )
