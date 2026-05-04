"""Analyst node — first LLM call. Synthesizes raw research into structured analysis."""
from __future__ import annotations

import json

from agent.llm import invoke_json, make_llm_quality as make_llm
from agent.observability import log_agent_call
from agent.prompts import ANALYST_PROMPT
from agent.state import ResearchState


def _build_raw_data(state: ResearchState) -> str:
    """Assemble what the analyst sees. Trim noisy fields the LLM doesn't need."""
    company = state.get("company", {})
    price = state.get("price", {})
    metrics = state.get("metrics", {})
    fin = state.get("financials", {})
    # Only the most recent period to keep prompt small
    latest_fin = (fin.get("periods") or [{}])[0] if isinstance(fin.get("periods"), list) else {}

    def _nonnull(d: dict, keys: tuple) -> dict:
        return {k: d.get(k) for k in keys if d.get(k) is not None}

    payload = {
        "company": _nonnull(company, ("ticker", "name", "sector", "industry")),
        "price": _nonnull(price, ("current_price", "market_cap", "pe_ratio", "forward_pe", "week_52_high", "week_52_low", "beta")),
        "financials": _nonnull(latest_fin, ("period_end", "revenue", "net_income", "operating_income", "free_cash_flow", "total_debt", "total_equity")) if latest_fin else {},
        "metrics": _nonnull(metrics, ("revenue_yoy_growth_pct", "gross_margin_pct", "operating_margin_pct", "net_margin_pct", "debt_to_equity", "fcf_margin_pct")),
        "news_count": len(state.get("news") or []),
        "filings_count": len(state.get("filings") or []),
    }
    return json.dumps(payload, default=str)


def analyst(state: ResearchState) -> dict:
    retry = state.get("retry_count", 0)

    # Surface previous critic feedback so the analyst can fix it on retry.
    prior_critique = state.get("critique") or {}
    critic_feedback = ""
    if retry > 0 and prior_critique:
        critic_feedback = json.dumps(prior_critique.get("issues", []), indent=2)

    prompt = ANALYST_PROMPT.format(
        raw_data=_build_raw_data(state),
        critic_feedback=critic_feedback or "(none — first pass)",
    )

    llm = make_llm(num_predict=900)
    try:
        analysis, telem = invoke_json(llm, prompt)
        ok, err = True, None
    except Exception as exc:
        analysis = {"error": str(exc)}
        telem = {"duration_ms": None}
        ok, err = False, str(exc)

    log_agent_call(
        research_id=state.get("research_id", "unknown"),
        ticker=state.get("ticker"),
        node="analyst",
        success=ok,
        duration_ms=telem.get("duration_ms"),
        model=telem.get("model"),
        prompt_tokens=telem.get("prompt_tokens"),
        completion_tokens=telem.get("completion_tokens"),
        retry_count=retry,
        error=err,
    )

    return {
        "analysis": analysis,
        "trace": [{"node": "analyst", "ok": ok, "duration_ms": telem.get("duration_ms"),
                   "retry_count": retry, "error": err,
                   "input_summary": f"{state.get('ticker')} price+fundamentals+qualitative",
                   "output_summary": analysis.get("thesis_one_liner", err or "error") if ok else err}],
    }
