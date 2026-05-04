"""Writer node — final LLM call. Produces the structured brief."""
from __future__ import annotations

import json

from agent.llm import invoke_json, make_llm_quality as make_llm
from agent.observability import log_agent_call
from agent.prompts import WRITER_PROMPT
from agent.state import ResearchState


def _writer_raw(state: ResearchState) -> str:
    news = state.get("news") or []
    price = state.get("price", {})
    headlines = [n.get("title", "") for n in news[:3]]
    p = {k: price.get(k) for k in ("current_price", "market_cap", "pe_ratio", "eps", "week_52_high", "week_52_low") if price.get(k) is not None}
    return json.dumps({"price": p, "headlines": headlines}, default=str)


def writer(state: ResearchState) -> dict:
    company = state.get("company") or {}
    analysis = state.get("analysis") or {}
    sentiment = state.get("sentiment") or {}
    price = state.get("price") or {}

    strengths = analysis.get("strengths") or []
    risks = analysis.get("risks") or []
    price_cur = price.get("current_price")
    w52h = price.get("week_52_high")
    w52l = price.get("week_52_low")
    price_summary = f"${price_cur:.2f}" if price_cur else "N/A"
    if price_cur and w52h and w52l:
        price_summary += f" (52w: ${w52l:.2f}–${w52h:.2f})"

    prompt = WRITER_PROMPT.format(
        company_name=company.get("name", state.get("ticker", "")),
        ticker=state.get("ticker", ""),
        thesis=analysis.get("thesis_one_liner", "No thesis available"),
        strengths="; ".join(strengths[:3]) if strengths else "No data",
        risks="; ".join(risks[:3]) if risks else "No data",
        market_assessment=analysis.get("market_assessment", "No market data"),
        overall_assessment=analysis.get("overall_assessment", "No overall assessment"),
        sentiment_label=sentiment.get("label", "NEUTRAL"),
        sentiment_score=sentiment.get("score", 0),
        price_summary=price_summary,
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
