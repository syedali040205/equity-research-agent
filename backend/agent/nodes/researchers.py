"""
Three researcher nodes that LangGraph runs in parallel.

Researchers are PURE DATA FETCHERS — no LLM calls. Each calls our existing
tools (Phase 2) and stuffs the structured output into state.

Best-practice (docs/agent-best-practices.md §9): parallel research is the
single largest latency win — 3 sequential calls at 1s each become 1 parallel call.
"""
from __future__ import annotations

import time

from agent.observability import log_agent_call
from agent.state import ResearchState
from tools.financials import get_financials
from tools.filings import get_recent_filings
from tools.metrics import compute_derived_metrics
from tools.news import get_recent_news
from tools.prices import get_price_snapshot


def _track(state: ResearchState, node: str, fn):
    """Time + log a researcher call. Errors don't kill the whole research."""
    start = time.perf_counter()
    try:
        result = fn()
        ok = True
        err = None
    except Exception as exc:
        result = None
        ok = False
        err = str(exc)
    duration_ms = int((time.perf_counter() - start) * 1000)

    log_agent_call(
        research_id=state.get("research_id", "unknown"),
        ticker=state.get("ticker"),
        node=node,
        success=ok,
        duration_ms=duration_ms,
        error=err,
    )
    return result, ok, err, duration_ms


def research_market(state: ResearchState) -> dict:
    """yfinance live: price, market cap, P/E, 52w range, beta."""
    result, ok, err, ms = _track(state, "researcher_market", lambda: get_price_snapshot(state["ticker"]))
    price_data = result.model_dump() if result else {"error": err}
    return {
        "price": price_data,
        "trace": [{"node": "researcher_market", "ok": ok, "duration_ms": ms, "error": err,
                   "input_summary": state["ticker"],
                   "output_summary": f"price={price_data.get('current_price')} pe={price_data.get('pe_ratio')}" if ok else err}],
    }


def research_fundamentals(state: ResearchState) -> dict:
    """yfinance live: financial statements + derived margins/growth/leverage."""
    fin, ok1, err1, ms1 = _track(state, "researcher_fundamentals_fin",
                                  lambda: get_financials(state["ticker"], period_type="annual"))
    metrics, ok2, err2, ms2 = _track(state, "researcher_fundamentals_metrics",
                                      lambda: compute_derived_metrics(fin) if fin else None)
    fin_data = fin.model_dump() if fin else {"error": err1}
    met_data = metrics.model_dump() if metrics else {"error": err2}
    return {
        "financials": fin_data,
        "metrics": met_data,
        "trace": [
            {"node": "researcher_fundamentals", "ok": ok1 and ok2,
             "duration_ms": ms1 + ms2, "error": err1 or err2,
             "input_summary": state["ticker"],
             "output_summary": f"revenue_growth={met_data.get('revenue_yoy_growth_pct')} margin={met_data.get('net_margin_pct')}" if ok1 and ok2 else err1 or err2},
        ],
    }


def research_qualitative(state: ResearchState) -> dict:
    """Postgres-backed: pre-ETL'd news + SEC filings."""
    news, ok1, err1, ms1 = _track(state, "researcher_qualitative_news",
                                   lambda: get_recent_news(state["ticker"], days=14, limit=15))
    filings, ok2, err2, ms2 = _track(state, "researcher_qualitative_filings",
                                      lambda: get_recent_filings(state["ticker"],
                                                                  types=["10-K", "10-Q", "8-K"], limit=10))
    articles = news.model_dump().get("articles", []) if news else []
    filings_list = filings.model_dump().get("filings", []) if filings else []
    return {
        "news": articles,
        "filings": filings_list,
        "trace": [
            {"node": "researcher_qualitative", "ok": ok1 and ok2,
             "duration_ms": ms1 + ms2, "error": err1 or err2,
             "input_summary": state["ticker"],
             "output_summary": f"{len(articles)} news, {len(filings_list)} filings"},
        ],
    }
