"""
Celery + Beat configuration.

Production-grade defaults pulled from docs/worker-best-practices.md:
- JSON-only serialization (no pickle code-execution risk)
- acks_late + reject_on_worker_lost (no lost tasks on worker crash)
- prefetch_multiplier=1 (I/O bound work, no hoarding)
- max_tasks_per_child=200 (recycle for memory)
- Multiple queues by priority
"""
from __future__ import annotations

from datetime import timedelta

from celery import Celery
from celery.schedules import crontab

from config import settings


app = Celery(
    "finagent_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "tasks.companies",
        "tasks.news",
        "tasks.filings",
        "tasks.pipeline",
    ],
)

app.conf.update(
    # --- Serialization (JSON only — never pickle) ---
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,

    # --- Reliability ---
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=200,

    # --- Result backend ---
    result_expires=3600,

    # --- Queue routing ---
    task_routes={
        "tasks.news.*":      {"queue": "realtime"},
        "tasks.companies.*": {"queue": "daily"},
        "tasks.filings.*":   {"queue": "batch"},
        "tasks.pipeline.*":  {"queue": "default"},
    },

    # --- Beat schedule ---
    beat_schedule={
        "news-every-N-min": {
            "task": "tasks.news.run_all",
            "schedule": timedelta(minutes=settings.NEWS_INTERVAL_MINUTES),
        },
        "companies-daily": {
            "task": "tasks.companies.bootstrap_companies",
            "schedule": crontab(hour=settings.COMPANIES_HOUR_UTC, minute=0),
        },
        "filings-daily": {
            "task": "tasks.filings.run_all",
            "schedule": crontab(hour=settings.FILINGS_HOUR_UTC, minute=0),
        },
    },
)


@app.on_after_configure.connect
def bootstrap(sender, **_):
    """
    On first connection, ensure schema exists and kick off an immediate
    end-to-end run so the DB has data without waiting for Beat.
    """
    from db import init_schema
    try:
        init_schema()
    except Exception as exc:
        print(f"[bootstrap] schema init warning: {exc}")

    sender.send_task("tasks.pipeline.run_full_pipeline")
