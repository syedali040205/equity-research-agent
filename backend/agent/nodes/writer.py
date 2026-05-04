"""Writer node — final LLM call. Produces the structured brief."""
from __future__ import annotations

import json

from agent.llm import invoke_json, make_llm
from agent.observability import log_agent_call
from agent.prompts import WRITER_PROMPT
from agent.state import ResearchState


def _writer_raw(state: ResearchState) -> str:
    """The writer also sees recent headlines so it can populate key_developments."""
    news = state.get("news") or []
    headlines = [{"title": n.get("title"), "source": n.get("source"),
                  "published_at": n.get("published_at")} for n in news[:5]]
    payload = {
        "metrics": state.get("metrics", {}),
        "price": {k: state.get("price", {}).get(k) for k in
                   ("current_price", "market_cap", "pe_ratio", "week_52_high", "week_52_low")},
        "recent_headlines": headlines,
        "filings_count": len(state.get("filings") or []),
    }
    return json.dumps(payload, default=str, indent=2)


def writer(state: ResearchState) -> dict:
    company = state.get("company") or {}
    prompt = WRITER_PROMPT.format(
        company_name=company.get("name", state.get("ticker", "")),
        ticker=state.get("ticker", ""),
        analysis=json.dumps(state.get("analysis", {}), indent=2),
        raw_data=_writer_raw(state),
    )

    llm = make_llm(num_predict=1200)
    try:
        brief, telem = invoke_json(llm, prompt)
        ok, err = True, None
    except Exception as exc:
        brief = {"error": str(exc)}
        telem = {"duration_ms": None}
        ok, err = False, str(exc)

    log_agent_call(
        research_id=state.get("research_id", "unknown"),
        ticker=state.get("ticker"),
        node="writer",
        success=ok,
        duration_ms=telem.get("duration_ms"),
        model=telem.get("model"),
        prompt_tokens=telem.get("prompt_tokens"),
        completion_tokens=telem.get("completion_tokens"),
        error=err,
    )

    return {
        "brief": brief,
        "trace": [{"node": "writer", "ok": ok, "duration_ms": telem.get("duration_ms"), "error": err,
                   "input_summary": f"analysis + {len(state.get('news') or [])} news headlines",
                   "output_summary": f"{brief.get('recommendation')} conf={brief.get('confidence')} target={brief.get('target_price')}" if ok else err}],
    }
