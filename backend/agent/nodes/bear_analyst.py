"""Bear analyst — argues the short/sell case. Runs in parallel with analyst."""
from __future__ import annotations

import json

from agent.llm import invoke_json, make_llm
from agent.observability import log_agent_call
from agent.state import ResearchState
from agent.nodes.analyst import _build_raw_data

_BEAR_PROMPT = """You are a short-seller research analyst. Your job is to find why this stock is OVERVALUED or dangerous. Be specific, use only the data provided.

DATA:
{raw_data}

Argue the SHORT case. Do not be balanced.

Output JSON only:
{{
  "bear_thesis": "<one sentence: core reason to avoid/sell this stock>",
  "overvaluation_argument": "<2-3 sentences on why current price is too high given the data>",
  "key_risks": [
    "<most dangerous specific risk>",
    "<second major risk>",
    "<third risk>"
  ],
  "bull_counterarguments_rebutted": "<2 sentences: address the obvious bull case and explain why it's insufficient>",
  "bear_confidence": <decimal 0.0-1.0: strength of bear case given available data>
}}

Rules: JSON only, no markdown. Use only data provided. If data is missing, use that as evidence of opacity risk.
"""


def bear_analyst(state: ResearchState) -> dict:
    prompt = _BEAR_PROMPT.format(raw_data=_build_raw_data(state))
    llm = make_llm(num_predict=600)
    try:
        result, telem = invoke_json(llm, prompt)
        ok, err = True, None
    except Exception as exc:
        result = {
            "bear_thesis": "Analysis unavailable",
            "overvaluation_argument": str(exc),
            "key_risks": [],
            "bull_counterarguments_rebutted": "",
            "bear_confidence": 0.0,
        }
        telem = {"duration_ms": None}
        ok, err = False, str(exc)

    log_agent_call(
        research_id=state.get("research_id", "unknown"),
        ticker=state.get("ticker"),
        node="bear_analyst",
        success=ok,
        duration_ms=telem.get("duration_ms"),
        model=telem.get("model"),
        error=err,
    )

    return {
        "bear_analysis": result,
        "trace": [{
            "node": "bear_analyst",
            "ok": ok,
            "duration_ms": telem.get("duration_ms"),
            "error": err,
            "input_summary": state.get("ticker", ""),
            "output_summary": result.get("bear_thesis", err or "error") if ok else err,
        }],
    }
