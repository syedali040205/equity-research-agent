"""
Public entry point: run_research(ticker) -> structured brief.

Wraps the LangGraph invocation with:
- UUID generation
- end-to-end timing
- final brief persistence to `briefs` table
"""
from __future__ import annotations

import time
from typing import Any

from agent.graph import agent_app
from agent.observability import new_research_id, save_brief
from core.config import settings


def run_research(ticker: str) -> dict:
    """Synchronous: introspect → research → analyze → critique → write → return."""
    research_id = new_research_id()
    initial: dict = {
        "research_id": research_id,
        "ticker": (ticker or "").strip().upper(),
        "retry_count": 0,
        "error_history": [],
        "trace": [],
    }

    start = time.perf_counter()
    final_state: dict = agent_app.invoke(initial)
    duration_ms = int((time.perf_counter() - start) * 1000)

    brief = final_state.get("brief", {})
    critique = final_state.get("critique", {})

    confidence = critique.get("confidence") or brief.get("confidence")
    if isinstance(confidence, (int, float)) and confidence > 1:
        confidence = round(confidence / 100, 2)
    sources_cited = (
        len(final_state.get("news") or []) +
        len(final_state.get("filings") or []) +
        (1 if final_state.get("price") else 0) +
        (1 if final_state.get("financials") else 0)
    )

    # Persist (best-effort — never block returning the brief)
    try:
        save_brief(
            research_id=research_id,
            ticker=initial["ticker"],
            brief=brief,
            raw_state=final_state,
            duration_ms=duration_ms,
            retry_count=final_state.get("retry_count", 0),
            confidence=confidence,
            sources_cited=sources_cited,
            model=settings.LLM_MODEL,
        )
    except Exception as exc:
        print(f"[runner] could not persist brief: {exc}")

    return {
        "research_id": research_id,
        "ticker": initial["ticker"],
        "duration_ms": duration_ms,
        "retry_count": final_state.get("retry_count", 0),
        "confidence": confidence,
        "sources_cited": sources_cited,
        "company": final_state.get("company", {}),
        "brief": brief,
        "analysis": final_state.get("analysis", {}),
        "sentiment": final_state.get("sentiment", {}),
        "critique": critique,
        "trace": final_state.get("trace", []),
        "error_history": final_state.get("error_history", []),
    }
