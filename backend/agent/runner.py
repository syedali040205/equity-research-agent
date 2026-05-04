"""
Public entry points:
  run_research(ticker)        -> full blocking result dict
  stream_research(ticker)     -> sync generator of SSE-ready event dicts
"""
from __future__ import annotations

import json
import time
from typing import Generator

from agent.graph import agent_app
from agent.observability import new_research_id, save_brief
from core.config import settings


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _build_result(research_id: str, ticker: str, final_state: dict, duration_ms: int) -> dict:
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
    try:
        save_brief(
            research_id=research_id,
            ticker=ticker,
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
        "ticker": ticker,
        "duration_ms": duration_ms,
        "retry_count": final_state.get("retry_count", 0),
        "confidence": confidence,
        "sources_cited": sources_cited,
        "company": final_state.get("company", {}),
        "brief": brief,
        "analysis": final_state.get("analysis", {}),
        "bear_analysis": final_state.get("bear_analysis", {}),
        "sentiment": final_state.get("sentiment", {}),
        "critique": critique,
        "trace": final_state.get("trace", []),
        "error_history": final_state.get("error_history", []),
    }


def _initial(ticker: str, research_id: str) -> dict:
    return {
        "research_id": research_id,
        "ticker": (ticker or "").strip().upper(),
        "retry_count": 0,
        "error_history": [],
        "trace": [],
    }


# ---------------------------------------------------------------------------
# Blocking entry point (legacy, kept for tests / non-streaming callers)
# ---------------------------------------------------------------------------

def run_research(ticker: str) -> dict:
    research_id = new_research_id()
    init = _initial(ticker, research_id)
    start = time.perf_counter()
    final_state: dict = agent_app.invoke(init)
    duration_ms = int((time.perf_counter() - start) * 1000)
    return _build_result(research_id, init["ticker"], final_state, duration_ms)


# ---------------------------------------------------------------------------
# Streaming entry point — yields SSE-ready dicts
# ---------------------------------------------------------------------------

# Fields that are safe to include in per-node SSE events
# (skip raw lists like news/filings to keep payloads small)
_STREAM_FIELDS = {
    "introspect":            ("company",),
    "research_market":       ("price",),
    "research_fundamentals": ("metrics",),
    "research_qualitative":  ("news", "filings"),
    "analyst":               ("analysis",),
    "bear_analyst":          ("bear_analysis",),
    "news_sentiment":        ("sentiment",),
    "critic":                ("critique",),
    "writer":                ("brief",),
}


def stream_research(ticker: str) -> Generator[dict, None, None]:
    """
    Yields one dict per completed LangGraph node, then a final 'complete' event.
    Each dict is JSON-serialisable — the SSE layer just needs to add 'data: …\n\n'.
    """
    research_id = new_research_id()
    init = _initial(ticker, research_id)
    start = time.perf_counter()

    # LangGraph .stream() yields {node_name: state_delta} one node at a time
    accumulated: dict = {}
    try:
        for chunk in agent_app.stream(init):
            node_name = next(iter(chunk))
            delta = chunk[node_name]

            # Merge trace (it uses operator.add reducer)
            if "trace" in delta:
                accumulated.setdefault("trace", [])
                accumulated["trace"] = accumulated["trace"] + delta["trace"]

            # Merge everything else
            for k, v in delta.items():
                if k != "trace":
                    accumulated[k] = v

            # Build the per-node payload (trim large lists)
            fields = _STREAM_FIELDS.get(node_name, ())
            payload: dict = {}
            for f in fields:
                val = delta.get(f)
                if val is not None:
                    if isinstance(val, list):
                        payload[f"${f}_count"] = len(val)
                    else:
                        payload[f] = val

            # Include the latest trace entry so frontend can update timing
            node_trace = [t for t in (delta.get("trace") or []) if t.get("node") == node_name]

            yield {
                "type": "node_complete",
                "node": node_name,
                "elapsed_ms": int((time.perf_counter() - start) * 1000),
                "trace_entry": node_trace[0] if node_trace else None,
                "payload": payload,
            }

    except Exception as exc:
        yield {"type": "error", "message": str(exc)}
        return

    duration_ms = int((time.perf_counter() - start) * 1000)
    result = _build_result(research_id, init["ticker"], accumulated, duration_ms)
    yield {"type": "complete", "result": result}
