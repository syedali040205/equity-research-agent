"""
Top-level orchestrator: runs companies → news → filings in order, with one
roll-up etl_runs entry summarizing the whole pipeline.
"""
from __future__ import annotations

from celery_app import app
from observability import track_run
from tasks.companies import bootstrap_companies
from tasks.filings import run_all as run_filings
from tasks.news import run_all as run_news


@app.task(name="tasks.pipeline.run_full_pipeline", acks_late=True)
def run_full_pipeline() -> dict:
    """End-to-end run. Each step is independent — a failure in one doesn't kill the next."""
    summary: dict = {}

    with track_run(pipeline="pipeline", metadata={"phase": "full"}) as run:
        # 1. Companies (must be first — provides CIKs needed for filings)
        try:
            summary["companies"] = bootstrap_companies.run()
        except Exception as exc:
            summary["companies"] = {"error": str(exc)}

        # 2. News
        try:
            summary["news"] = run_news.run()
        except Exception as exc:
            summary["news"] = {"error": str(exc)}

        # 3. Filings (depends on companies having CIKs)
        try:
            summary["filings"] = run_filings.run()
        except Exception as exc:
            summary["filings"] = {"error": str(exc)}

        run.set(metadata=summary)

    return summary
