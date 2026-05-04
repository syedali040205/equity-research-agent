"""
LLM helpers: ChatOllama wrapper + structured JSON output extraction.

Output safety (from docs/agent-best-practices.md §6):
- Always strip markdown fences before parsing
- Try a regex JSON extract as fallback
- Validate the result is a dict before returning
"""
from __future__ import annotations

import json
import re
import time
from typing import Any, Optional

from langchain_ollama import ChatOllama

from core.config import settings


def make_llm(temperature: float = 0.0, num_predict: int = 1024,
             num_ctx: int = 4096, format: Optional[str] = "json") -> ChatOllama:
    """Build a ChatOllama with sensible defaults for structured output."""
    kwargs = dict(
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
    """
    Parse JSON from an LLM response.

    Strategy: strip fences -> json.loads. If that fails, find the first {...}
    in the raw string and try again. If nothing parses, raise.
    """
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


def invoke_json(llm: ChatOllama, prompt: str) -> tuple[dict, dict]:
    """
    Invoke LLM and return (parsed_json, telemetry).
    Telemetry includes duration_ms and approximate token counts.
    """
    start = time.perf_counter()
    resp = llm.invoke(prompt)
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    raw = resp.content if hasattr(resp, "content") else str(resp)
    parsed = extract_json(raw)

    # Ollama puts token counts in response.response_metadata when available
    meta = getattr(resp, "response_metadata", {}) or {}
    telemetry = {
        "duration_ms": elapsed_ms,
        "model": settings.LLM_MODEL,
        "prompt_tokens": meta.get("prompt_eval_count"),
        "completion_tokens": meta.get("eval_count"),
    }
    return parsed, telemetry
