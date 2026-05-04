"""Write one row per LLM call to agent_runs, plus the final brief to briefs."""
from __future__ import annotations

import json
import uuid
from typing import Optional

import psycopg2

from core.config import settings


def _conn():
    return psycopg2.connect(settings.DATABASE_URL)


def log_agent_call(
    *,
    research_id: str,
    ticker: Optional[str],
    node: str,
    success: bool,
    duration_ms: Optional[int] = None,
    model: Optional[str] = None,
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
    retry_count: int = 0,
    error: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    conn = _conn()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO agent_runs
                  (research_id, ticker, node, model, success, duration_ms,
                   prompt_tokens, completion_tokens, retry_count, error, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    research_id, ticker, node, model, success, duration_ms,
                    prompt_tokens, completion_tokens, retry_count,
                    (error or "")[:4000] or None,
                    json.dumps(metadata) if metadata else None,
                ),
            )
    finally:
        conn.close()


def save_brief(
    *,
    research_id: str,
    ticker: str,
    brief: dict,
    raw_state: dict,
    duration_ms: int,
    retry_count: int,
    confidence: Optional[float] = None,
    sources_cited: Optional[int] = None,
    model: Optional[str] = None,
) -> None:
    conn = _conn()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO briefs
                  (id, ticker, model, duration_ms, retry_count, confidence,
                   sources_cited, brief, raw_state)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb)
                """,
                (
                    research_id, ticker, model, duration_ms, retry_count,
                    confidence, sources_cited,
                    json.dumps(brief), json.dumps(raw_state, default=str),
                ),
            )
    finally:
        conn.close()


def new_research_id() -> str:
    return str(uuid.uuid4())
