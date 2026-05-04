"""Sentiment node — fast LLM pass over news headlines, runs in parallel with analyst."""
from __future__ import annotations

from agent.llm import invoke_json, make_llm
from agent.observability import log_agent_call
from agent.prompts import SENTIMENT_PROMPT
from agent.state import ResearchState


def sentiment(state: ResearchState) -> dict:
    news = state.get("news") or []
    headlines = "\n".join(
        f"- [{n.get('source', '')}] {n.get('title', '')}"
        for n in news[:20]
    )
    if not headlines:
        return {
            "sentiment": {"score": 0.0, "label": "NEUTRAL", "drivers": [], "summary": "No news available."},
            "trace": [{"node": "news_sentiment", "ok": True, "duration_ms": 0,
                       "input_summary": "no news", "output_summary": "NEUTRAL 0.0"}],
        }

    prompt = SENTIMENT_PROMPT.format(
        headlines=headlines,
        ticker=state.get("ticker", ""),
    )

    llm = make_llm(num_predict=300)
    try:
        result, telem = invoke_json(llm, prompt)
        ok, err = True, None
    except Exception as exc:
        result = {"score": 0.0, "label": "NEUTRAL", "drivers": [], "summary": str(exc)}
        telem = {"duration_ms": None}
        ok, err = False, str(exc)

    # Normalize score to -1..1
    score = result.get("score", 0.0)
    if isinstance(score, (int, float)):
        result["score"] = max(-1.0, min(1.0, float(score)))

    log_agent_call(
        research_id=state.get("research_id", "unknown"),
        ticker=state.get("ticker"),
        node="news_sentiment",
        success=ok,
        duration_ms=telem.get("duration_ms"),
        model=telem.get("model"),
        prompt_tokens=telem.get("prompt_tokens"),
        completion_tokens=telem.get("completion_tokens"),
        error=err,
    )

    label = result.get("label", "NEUTRAL")
    score_str = f"{result['score']:+.2f}"
    return {
        "sentiment": result,
        "trace": [{"node": "news_sentiment", "ok": ok, "duration_ms": telem.get("duration_ms"),
                   "error": err,
                   "input_summary": f"{len(news)} headlines",
                   "output_summary": f"{label} {score_str}"}],
    }
