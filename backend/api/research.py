"""POST /api/research — runs the multi-agent graph for a single ticker."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from agent.runner import run_research
from db import query_cursor

router = APIRouter(prefix="/api/research", tags=["research"])


class ResearchRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)


@router.post("")
def create_research(req: ResearchRequest):
    try:
        result = run_research(req.ticker)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return result


@router.get("/history")
def research_history(
    limit: int = Query(20, ge=1, le=100),
    ticker: str = Query(None),
):
    """Recent research briefs from DB — for the history drawer."""
    with query_cursor() as cur:
        if ticker:
            t = ticker.strip().upper()
            cur.execute(
                """
                SELECT id, ticker, generated_at, model, duration_ms,
                       confidence, sources_cited,
                       brief->>'recommendation' AS recommendation,
                       brief->>'summary' AS summary
                FROM briefs
                WHERE ticker = %s
                ORDER BY generated_at DESC LIMIT %s
                """,
                (t, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, ticker, generated_at, model, duration_ms,
                       confidence, sources_cited,
                       brief->>'recommendation' AS recommendation,
                       brief->>'summary' AS summary
                FROM briefs
                ORDER BY generated_at DESC LIMIT %s
                """,
                (limit,),
            )
        rows = cur.fetchall()

    return {
        "count": len(rows),
        "briefs": [
            {
                "research_id": str(r["id"]),
                "ticker": r["ticker"],
                "generated_at": r["generated_at"].isoformat() if r["generated_at"] else None,
                "model": r["model"],
                "duration_ms": r["duration_ms"],
                "confidence": float(r["confidence"]) if r["confidence"] is not None else None,
                "sources_cited": r["sources_cited"],
                "recommendation": r["recommendation"],
                "summary": (r["summary"] or "")[:200],
            }
            for r in rows
        ],
    }
