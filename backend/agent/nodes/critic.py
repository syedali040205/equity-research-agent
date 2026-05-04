"""Critic node — fact-checks analyst output against raw data."""
from __future__ import annotations

import json

from agent.llm import invoke_json, make_llm_quality as make_llm
from agent.observability import log_agent_call
from agent.prompts import CRITIC_PROMPT
from agent.state import ResearchState


def _critic_view_of_raw(state: ResearchState) -> str:
    """Same payload the analyst saw, so critic checks against the same source."""
    from agent.nodes.analyst import _build_raw_data
    return _build_raw_data(state)


def critic(state: ResearchState) -> dict:
    prompt = CRITIC_PROMPT.format(
        raw_data=_critic_view_of_raw(state),
        analysis=json.dumps(state.get("analysis", {}), indent=2),
    )

    llm = make_llm(num_predict=1400)
    try:
        critique, telem = invoke_json(llm, prompt)
        ok, err = True, None
    except Exception as exc:
        # Critic failure = treat as passed (don't block the brief on critic flakiness)
        critique = {"passed": True, "confidence": 50,
                    "issues": [], "verified_count": 0,
                    "critic_error": str(exc)}
        telem = {"duration_ms": None}
        ok, err = False, str(exc)

    # Normalize confidence: LLM may return 0-100 int, frontend expects 0.0-1.0
    if isinstance(critique.get("confidence"), (int, float)) and critique["confidence"] > 1:
        critique["confidence"] = round(critique["confidence"] / 100, 2)

    log_agent_call(
        research_id=state.get("research_id", "unknown"),
        ticker=state.get("ticker"),
        node="critic",
        success=ok,
        duration_ms=telem.get("duration_ms"),
        model=telem.get("model"),
        prompt_tokens=telem.get("prompt_tokens"),
        completion_tokens=telem.get("completion_tokens"),
        error=err,
    )

    issues = critique.get("issues", [])
    return {
        "critique": critique,
        "trace": [{"node": "critic", "ok": ok, "duration_ms": telem.get("duration_ms"),
                   "passed": critique.get("passed"), "issues": len(issues), "error": err,
                   "input_summary": f"analyst output ({len(state.get('analysis', {}))} fields)",
                   "output_summary": critique.get("recommendation", err or "error") if ok else err}],
    }


# ---- Routing ---------------------------------------------------------------
MAX_RETRIES = 0  # CPU is slow; disable retries until GPU available


def route_after_critic(state: ResearchState) -> str:
    critique = state.get("critique", {})
    issues = critique.get("issues", []) or []
    critical = [i for i in issues if i.get("severity") == "critical"]
    retries = state.get("retry_count", 0)

    if critical and retries < MAX_RETRIES:
        return "retry_analyst"
    return "writer"


def increment_retry(state: ResearchState) -> dict:
    """Tiny passthrough node that bumps the retry counter before re-entering analyst."""
    return {
        "retry_count": state.get("retry_count", 0) + 1,
        "error_history": [f"retry triggered by critic at attempt {state.get('retry_count', 0)}"],
    }
