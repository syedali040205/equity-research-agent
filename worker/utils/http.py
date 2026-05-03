"""HTTP helpers: SEC-compliant client + simple rate-limited GET."""
from __future__ import annotations

import time
from typing import Optional

import requests

from config import settings


# A single shared session — reuses connections, lower latency.
_session = requests.Session()
_session.headers.update(
    {
        "User-Agent": settings.SEC_USER_AGENT,
        "Accept": "application/json",
    }
)


def sec_get(url: str, *, timeout: int = 20, accept: Optional[str] = None) -> requests.Response:
    """
    GET against SEC. Honors SEC's 10 req/sec policy with a per-call sleep,
    requires a real User-Agent (set via SEC_USER_AGENT env), and raises on HTTP errors.
    """
    headers = {}
    if accept:
        headers["Accept"] = accept

    time.sleep(settings.SEC_RATE_LIMIT_MS / 1000)
    resp = _session.get(url, headers=headers or None, timeout=timeout)
    resp.raise_for_status()
    return resp
