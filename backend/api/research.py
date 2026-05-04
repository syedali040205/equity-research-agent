"""Research API — stream, blocking, history, single-brief, and chat endpoints."""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agent.runner import run_research, stream_research
from db import query_cursor

router = APIRouter(prefix="/api/research", tags=["research"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ResearchRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)


# ---------------------------------------------------------------------------
# Streaming endpoint  (GET so EventSource works from browser)
# ---------------------------------------------------------------------------

@router.get("/stream")
def stream_research_sse(ticker: str = Query(..., min_length=1, max_length=10)):
    """SSE stream — yields one event per completed node, then a 'complete' event."""

    def event_gen():
        try:
            for event in stream_research(ticker):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# Blocking endpoint (kept for backward compat / non-streaming clients)
# ---------------------------------------------------------------------------

@router.post("")
def create_research(req: ResearchRequest):
    try:
        return run_research(req.ticker)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Single brief  (for share links)
# ---------------------------------------------------------------------------

@router.get("/{research_id}")
def get_research(research_id: str):
    with query_cursor() as cur:
        cur.execute(
            """
            SELECT id, ticker, generated_at, model, duration_ms,
                   retry_count, confidence, sources_cited, brief, raw_state
            FROM briefs WHERE id = %s
            """,
            (research_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Research not found")

    raw = row["raw_state"] or {}
    brief = row["brief"] or {}
    critique = raw.get("critique", {})
    confidence = float(row["confidence"]) if row["confidence"] is not None else None

    return {
        "research_id": str(row["id"]),
        "ticker": row["ticker"],
        "generated_at": row["generated_at"].isoformat() if row["generated_at"] else None,
        "duration_ms": row["duration_ms"],
        "retry_count": row["retry_count"],
        "confidence": confidence,
        "sources_cited": row["sources_cited"],
        "model": row["model"],
        "company": raw.get("company", {}),
        "brief": brief,
        "analysis": raw.get("analysis", {}),
        "sentiment": raw.get("sentiment", {}),
        "critique": critique,
        "trace": raw.get("trace", []),
        "error_history": raw.get("error_history", []),
    }


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

@router.get("/history")
def research_history(
    limit: int = Query(20, ge=1, le=100),
    ticker: str = Query(None),
):
    with query_cursor() as cur:
        if ticker:
            t = ticker.strip().upper()
            cur.execute(
                """
                SELECT id, ticker, generated_at, model, duration_ms,
                       confidence, sources_cited,
                       brief->>'recommendation' AS recommendation,
                       brief->>'summary' AS summary
                FROM briefs WHERE ticker = %s
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


# ---------------------------------------------------------------------------
# Follow-up Q&A chat
# ---------------------------------------------------------------------------

@router.post("/{research_id}/chat")
def chat_with_brief(research_id: str, req: ChatRequest):
    """Answer a follow-up question grounded in the stored brief + analysis."""
    with query_cursor() as cur:
        cur.execute(
            "SELECT ticker, brief, raw_state FROM briefs WHERE id = %s",
            (research_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Research not found")

    brief = row["brief"] or {}
    raw = row["raw_state"] or {}
    analysis = raw.get("analysis", {})
    sentiment = raw.get("sentiment", {})
    price = raw.get("price", {})

    context = json.dumps({
        "ticker": row["ticker"],
        "brief": brief,
        "analysis": analysis,
        "sentiment": sentiment,
        "price_snapshot": {k: price.get(k) for k in ("current_price", "week_52_high", "week_52_low", "pe_ratio")},
    }, default=str, indent=2)

    prompt = f"""You are a financial analyst assistant. Answer the user's question using ONLY the research context below.
Be concise (2-4 sentences). Do not invent numbers not in the context.

RESEARCH CONTEXT:
{context}

USER QUESTION: {req.question}

Answer:"""

    from agent.llm import make_llm
    llm = make_llm(num_predict=400)
    try:
        response = llm.invoke(prompt)
        answer = response.content if hasattr(response, "content") else str(response)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"answer": answer.strip(), "research_id": research_id}
