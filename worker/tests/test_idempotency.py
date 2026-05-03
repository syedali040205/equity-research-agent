"""
Integration tests that exercise idempotency. Require a running Postgres.
Run inside the worker container:
    docker compose exec worker python -m pytest tests/test_idempotency.py -v
"""
from __future__ import annotations

import os
import pytest

from db import cursor, init_schema


pytestmark = pytest.mark.skipif(
    "DATABASE_URL" not in os.environ,
    reason="needs Postgres (run inside worker container)",
)


@pytest.fixture(scope="module", autouse=True)
def _schema():
    init_schema()
    yield


def _row_count(table: str, **where) -> int:
    sql = f"SELECT COUNT(*) FROM {table}"
    params: tuple = ()
    if where:
        clauses = " AND ".join(f"{k} = %s" for k in where)
        sql += f" WHERE {clauses}"
        params = tuple(where.values())
    with cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()[0]


def test_companies_upsert_is_idempotent():
    from tasks.companies import bootstrap_companies
    # Two consecutive runs must not create duplicates.
    bootstrap_companies.run()
    n1 = _row_count("companies")
    bootstrap_companies.run()
    n2 = _row_count("companies")
    assert n1 == n2 and n1 >= 20


def test_etl_runs_records_each_invocation():
    """Each run should APPEND a new etl_runs row (history is preserved)."""
    from tasks.companies import bootstrap_companies
    before = _row_count("etl_runs", pipeline="companies")
    bootstrap_companies.run()
    after = _row_count("etl_runs", pipeline="companies")
    assert after > before
