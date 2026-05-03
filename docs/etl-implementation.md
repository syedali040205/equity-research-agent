# ETL Implementation Notes

How the practices in [etl-best-practices.md](etl-best-practices.md) and [worker-best-practices.md](worker-best-practices.md) map to actual code in this repo.

---

## Pipelines

| Pipeline | Source | Schedule | Purpose |
|---|---|---|---|
| `companies` | SEC ticker→CIK map | Daily 20:00 UTC | Seed `companies` + resolve CIKs |
| `news`      | Yahoo Finance per-ticker RSS | Every 30 min | Accumulate article history |
| `filings`   | SEC EDGAR submissions API | Daily 22:00 UTC | Latest 10-K / 10-Q / 8-K metadata |

Prices and quarterly financials are **NOT** ETL'd — they come from `yfinance` on demand at agent query time (always fresh, instant).

---

## Code map

```
worker/
├── celery_app.py        — Celery + Beat, JSON serialization, queue routing, bootstrap on startup
├── config.py            — Pydantic settings from .env
├── db.py                — Postgres connection, idempotent schema init, CLI: python -m db init
├── watchlist.py         — 20 tickers + COMPANY_META
├── observability.py     — track_run() context manager + log_etl_run()
├── circuit_breaker.py   — is_open(ticker, pipeline) — checks recent failures
├── utils/
│   ├── http.py          — SEC-compliant rate-limited GET (User-Agent header, 150ms gap)
│   └── validation.py    — Schema + business rule checks (pure functions)
├── tasks/
│   ├── companies.py     — bootstrap_companies (CIK resolution, ON CONFLICT upsert)
│   ├── news.py          — fetch_for_ticker + run_all (Yahoo RSS → Postgres)
│   ├── filings.py       — fetch_for_ticker + run_all (EDGAR submissions API)
│   └── pipeline.py      — run_full_pipeline (companies → news → filings)
└── tests/
    ├── test_validation.py    — Pure-function unit tests (no DB)
    └── test_idempotency.py   — Integration tests (need running Postgres)
```

---

## How best practices appear in code

### Idempotent upserts
Every load uses `INSERT ... ON CONFLICT DO UPDATE`. Re-running never duplicates.
- Companies → conflict on `ticker`
- News → conflict on `url`
- Filings → conflict on `accession_number`

### Per-ticker circuit breaker
[circuit_breaker.py](../worker/circuit_breaker.py) queries `etl_runs` for the last hour. If a ticker has 3+ failures, the next attempt logs `status='skipped'` and moves on. One delisted/rate-limited ticker can't stall 19 others.

### Exponential backoff with jitter
Every Celery task:
```python
@app.task(autoretry_for=(Exception,), retry_backoff=True,
          retry_backoff_max=120, retry_jitter=True, max_retries=2)
```

### Observability via etl_runs
[observability.py](../worker/observability.py) `track_run()` context manager:
- Times the work
- On success: logs `status='success'` + row counts + duration_ms
- On exception: logs `status='failed'` + error message + duration_ms, then re-raises

Query the dashboard in SQL anytime:
```bash
make etl-status
```

### Validation before insert
[utils/validation.py](../worker/utils/validation.py) — pure functions, no DB. Each row is checked before the SQL call. Rejected rows increment `rows_rejected` in the run log.

### Reliability flags (Celery worker)
[celery_app.py](../worker/celery_app.py):
- `task_acks_late=True` — task survives worker crashes mid-execution
- `task_reject_on_worker_lost=True` — re-queue if worker dies
- `worker_prefetch_multiplier=1` — no hoarding of slow I/O tasks
- `worker_max_tasks_per_child=200` — recycle workers to release memory
- `accept_content=['json']` — block pickle code-execution attacks

### Single Beat instance
[docker-compose.yml](../docker-compose.yml) — `beat` service has `deploy.replicas: 1`. Multiple Beat schedulers would duplicate every scheduled task.

### Bootstrap on startup
[celery_app.py](../worker/celery_app.py) — `@app.on_after_configure.connect` calls `init_schema()` and immediately fires `run_full_pipeline`. New deploys have data within seconds.

### SEC rate-limit compliance
[utils/http.py](../worker/utils/http.py) — sleeps `SEC_RATE_LIMIT_MS` between requests + sets the User-Agent header SEC requires. SEC will block clients without proper headers.

---

## Running it

### First-time setup
```bash
cp .env.example .env
# edit .env — at minimum, set SEC_USER_AGENT to your real email
make up
```

Within ~30 seconds you should see:
```
worker-1 | [companies] upserted=25
worker-1 | [news]      fetched X tickers
worker-1 | [filings]   fetched X tickers
```

### Inspect
```bash
make ps                  # service status
make worker-logs         # tail worker logs
make beat-logs           # tail beat scheduler
make psql                # interactive SQL prompt
make etl-status          # one-shot pipeline health summary
make flower              # → http://localhost:5555 (Celery UI)
```

### Manual triggers
```bash
make seed-companies
make seed-news
make seed-filings
make seed-all
```

### Reset
```bash
make reset               # wipes Postgres + Redis volumes
```

### Tests
```bash
make test                # validation + idempotency
```

---

## What we deliberately did NOT build (and why)

| Skipped | Why |
|---|---|
| dbt | Overkill — we have ~5 tables and no transformation layer beyond load |
| Airflow | Overkill — Celery + Beat is enough for 4 pipelines |
| Great Expectations | Adds 100+ MB of deps for what fits in `validation.py` |
| Full 10-K text parsing | Variable per company; doing on-demand at agent query time is cleaner |
| Prometheus/Grafana | `etl_runs` table + Flower covers our observability needs at portfolio scale |
| SCD Type 2 dimensions | Companies metadata changes once per year; full-history audit not justified |

The bar: every dependency must earn its place. We added Postgres, Redis, Celery, Flower — each does work the project actually needs.
