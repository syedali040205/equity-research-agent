"""
ResearchState — the single source of truth that flows through every node.

Best-practice notes (from docs/agent-best-practices.md):
- TypedDict with total=False so each node only sets the keys it owns
- Annotated reducers on list fields so parallel branches don't overwrite each other
- One UUID per research run for tracing all LLM calls together
"""
from __future__ import annotations

import operator
from typing import Annotated, Any, List, Optional, TypedDict


class ResearchState(TypedDict, total=False):
    # ---- Identifiers ----
    research_id: str                # UUID, groups all agent_runs rows
    ticker: str

    # ---- From introspect ----
    company: dict                   # CompanyOverview as dict

    # ---- From researchers (run in parallel) ----
    price: dict                     # PriceSnapshot
    financials: dict                # Financials
    metrics: dict                   # DerivedMetrics
    news: List[dict]                # list of NewsArticle
    filings: List[dict]             # list of Filing

    # ---- From sentiment (parallel with analyst) ----
    sentiment: dict                 # {score, label, drivers, summary}

    # ---- From analyst ----
    analysis: dict                  # {strengths, risks, narrative, key_metrics, ...}

    # ---- From critic ----
    critique: dict                  # {passed, issues, severity, ...}

    # ---- From writer ----
    brief: dict                     # final structured brief

    # ---- Self-correction ----
    retry_count: int
    error_history: Annotated[List[str], operator.add]    # appends, never overwrites

    # ---- Audit trail (every node appends one entry) ----
    trace: Annotated[List[dict], operator.add]
