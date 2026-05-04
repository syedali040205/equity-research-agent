"""Validate the ticker exists in our watchlist before any LLM/network work."""
from __future__ import annotations

from agent.state import ResearchState
from tools.companies import get_company_overview


def introspect(state: ResearchState) -> dict:
    overview = get_company_overview(state["ticker"])
    if overview.error:
        # Short-circuit: mark error_history; downstream nodes will pass through.
        return {
            "company": overview.model_dump(),
            "error_history": [f"introspect: {overview.error}"],
            "trace": [{"node": "introspect", "ok": False, "duration_ms": 0, "error": overview.error}],
        }
    return {
        "company": overview.model_dump(),
        "trace": [{"node": "introspect", "ok": True, "duration_ms": 0}],
    }
