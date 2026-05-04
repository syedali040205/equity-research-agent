"""LLM helpers: Groq (primary) / Ollama (fallback) + JSON extraction."""
from __future__ import annotations

import json
import re
import time
from typing import Any, Optional

from core.config import settings


def make_llm_quality(temperature: float = 0.0, num_predict: int = 1024,
                     num_ctx: int = 4096, format: Optional[str] = "json"):
    """Higher-quality LLM for analyst/critic/writer. Model controlled by LLM_QUALITY_MODEL env var."""
    if settings.GROQ_API_KEY:
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=settings.LLM_QUALITY_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=temperature,
            max_tokens=num_predict,
        )
    return make_llm(temperature=temperature, num_predict=num_predict, num_ctx=num_ctx, format=format)


def make_llm(temperature: float = 0.0, num_predict: int = 1024,
             num_ctx: int = 4096, format: Optional[str] = "json"):
    """Return a ChatGroq or ChatOllama depending on GROQ_API_KEY presence."""
    if settings.GROQ_API_KEY:
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=settings.LLM_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=temperature,
            max_tokens=num_predict,
        )
    else:
        from langchain_ollama import ChatOllama
        kwargs: dict[str, Any] = dict(
            model=settings.LLM_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temperature,
            num_predict=num_predict,
            num_ctx=num_ctx,
        )
        if format:
            kwargs["format"] = format
        return ChatOllama(**kwargs)


_FENCE_RE = re.compile(r"^```[a-zA-Z]*\n?|\n?```$", re.MULTILINE)
_JSON_RE = re.compile(r"\{[\s\S]*\}")


def extract_json(raw: str) -> dict:
    """Parse JSON from LLM response, stripping fences and falling back to regex."""
    if raw is None:
        raise ValueError("empty LLM response")

    cleaned = _FENCE_RE.sub("", raw.strip()).strip()

    try:
        out = json.loads(cleaned)
    except json.JSONDecodeError:
        match = _JSON_RE.search(cleaned)
        if not match:
            raise ValueError(f"no JSON object in response: {raw[:200]!r}")
        out = json.loads(match.group())

    if not isinstance(out, dict):
        raise ValueError(f"expected JSON object, got {type(out).__name__}")
    return out


def invoke_json(llm, prompt: str) -> tuple[dict, dict]:
    """Invoke LLM and return (parsed_json, telemetry)."""
    start = time.perf_counter()
    resp = llm.invoke(prompt)
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    raw = resp.content if hasattr(resp, "content") else str(resp)
    parsed = extract_json(raw)

    meta = getattr(resp, "response_metadata", {}) or {}
    telemetry = {
        "duration_ms": elapsed_ms,
        "model": settings.LLM_MODEL,
        "prompt_tokens": meta.get("prompt_eval_count") or meta.get("prompt_tokens"),
        "completion_tokens": meta.get("eval_count") or meta.get("completion_tokens"),
    }
    return parsed, telemetry
