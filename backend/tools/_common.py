"""Shared helpers for tools."""
from __future__ import annotations

import re
from typing import Optional


_TICKER_RE = re.compile(r"^[A-Z]{1,5}([.-][A-Z]{1,3})?$")


def normalize_ticker(ticker: str) -> Optional[str]:
    """Uppercase + validate format. Returns None if invalid."""
    if not ticker or not isinstance(ticker, str):
        return None
    t = ticker.strip().upper()
    return t if _TICKER_RE.match(t) else None


def safe_float(x) -> Optional[float]:
    """Convert numpy/pandas scalars to native float, dropping NaN/inf."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):  # NaN check
        return None
    return f


def safe_int(x) -> Optional[int]:
    f = safe_float(x)
    return int(f) if f is not None else None
