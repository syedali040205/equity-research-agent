"""
Read-only Postgres helper for the backend.

The backend never writes — only the worker ETL writes. We still use
the same DATABASE_URL but always open transactions and roll back so
nothing leaks even if a tool tries to write.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings


def _connect():
    return psycopg2.connect(settings.DATABASE_URL)


@contextmanager
def query_cursor(dict_rows: bool = True) -> Iterator:
    """Open a read-only cursor; rollback on exit (defense-in-depth — backend doesn't write)."""
    conn = _connect()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor) if dict_rows else conn.cursor()
        try:
            yield cur
        finally:
            cur.close()
            conn.rollback()
    finally:
        conn.close()


def healthcheck() -> dict:
    try:
        with query_cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            cur.fetchone()
        return {"db": "ok"}
    except Exception as exc:
        return {"db": "error", "error": str(exc)}
