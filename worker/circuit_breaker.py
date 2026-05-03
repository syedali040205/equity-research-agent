"""Per-ticker circuit breaker. Stops calling APIs that have been failing repeatedly."""
from __future__ import annotations

from db import cursor
from config import settings


def is_open(ticker: str, pipeline: str) -> bool:
    """
    Return True if (ticker, pipeline) has had >= N failed runs in the recent window.
    When the circuit is open, the caller should skip this ticker.
    """
    with cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*) FROM etl_runs
            WHERE ticker = %s
              AND pipeline = %s
              AND status = 'failed'
              AND run_at > NOW() - INTERVAL '{settings.CIRCUIT_BREAKER_WINDOW_MIN} minutes'
            """,
            (ticker, pipeline),
        )
        recent_failures = cur.fetchone()[0]
    return recent_failures >= settings.CIRCUIT_BREAKER_FAILURES
