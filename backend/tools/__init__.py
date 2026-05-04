"""
Agent tool layer.

Each tool is a pure-ish Python function that:
- accepts validated, typed input
- returns a Pydantic model (structured for the LLM to reason about)
- catches its own errors and returns a structured error payload

Tools are composed by LangGraph agents in Phase 3.
"""
from .companies  import get_company_overview, CompanyOverview
from .prices     import get_price_snapshot, PriceSnapshot
from .financials import get_financials, Financials
from .news       import get_recent_news, NewsArticle
from .filings    import get_recent_filings, Filing
from .metrics    import compute_derived_metrics, DerivedMetrics

__all__ = [
    "get_company_overview", "CompanyOverview",
    "get_price_snapshot", "PriceSnapshot",
    "get_financials", "Financials",
    "get_recent_news", "NewsArticle",
    "get_recent_filings", "Filing",
    "compute_derived_metrics", "DerivedMetrics",
]
