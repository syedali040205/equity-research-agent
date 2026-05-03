# Celery Worker Best Practices (Production Grade)

> Consolidated from Celery docs, Wolt engineering blog, Vinta Software, Denis Berthovic's Celery Best Practices.
> Reference for the FinancialAgent worker design decisions.

---

## 1. Task Design Principles

### Atomicity — one logical operation per task
Each task does one thing and does it completely.

```python
# Bad — combines extract + transform + load in one task
@app.task
def run_prices():
    data = fetch_from_yfinance()
    cleaned = transform(data)
    insert_to_db(cleaned)  # if this fails, fetch is wasted but can't retry cleanly

# Good — separate tasks, each independently retryable
@app.task
def fetch_prices(ticker): ...

@app.task
def load_prices(ticker, rows): ...

@app.task
def run_prices_pipeline(ticker):
    rows = fetch_prices.run(ticker)
    load_prices.run(ticker, rows)
```

### Idempotency — same input, same result, always
Every task must be safe to run multiple times. Celery retries tasks on failure — if your task isn't idempotent, retries cause duplicates or corruption.

```python
# Safe — upsert on conflict, never creates duplicates
def load_to_db(rows):
    conn.execute("""
        INSERT INTO daily_prices (ticker, date, close)
        VALUES (%s, %s, %s)
        ON CONFLICT (ticker, date)
        DO UPDATE SET close = EXCLUDED.close, updated_at = NOW()
    """, rows)
```

### Short tasks
Long tasks occupy workers and block the queue. If a task takes > 5 minutes:
- Break it into subtasks (one per ticker)
- Use `chain()` or `group()` to compose them
- Set a hard timeout with `time_limit`

```python
@app.task(time_limit=300, soft_time_limit=240)  # 5 min hard, 4 min soft
def ingest_prices_for_ticker(ticker): ...
```

### `acks_late=True` — acknowledge after completion, not before
Default Celery acknowledges the task as soon as it's received. If the worker crashes mid-execution, the task is lost.

```python
@app.task(
    acks_late=True,                    # acknowledge only after task completes
    task_reject_on_worker_lost=True,   # re-queue if worker dies
)
def ingest_prices(ticker): ...
```

---

## 2. Queue Design

### Multiple queues by priority
Never put all tasks on one queue. High-priority work gets blocked by long batch jobs.

```python
# celery_app.py
app.conf.task_routes = {
    "tasks.news.*":       {"queue": "realtime"},   # runs every 30 min, fast
    "tasks.prices.*":     {"queue": "daily"},       # runs daily, medium
    "tasks.filings.*":    {"queue": "batch"},       # runs daily, slow (SEC API)
    "tasks.financials.*": {"queue": "batch"},       # runs weekly, slow
}
```

Start workers listening to specific queues:
```bash
celery -A celery_app worker -Q realtime --concurrency=4
celery -A celery_app worker -Q daily,batch --concurrency=2
```

### Dead letter queue (DLQ)
After `max_retries` exceeded, route to DLQ for manual inspection:

```python
@app.task(
    max_retries=3,
    on_failure=send_to_dlq  # custom callback
)
def ingest_prices(ticker): ...

def send_to_dlq(self, exc, task_id, args, kwargs, einfo):
    app.send_task("tasks.dlq.record_failure", args=[task_id, str(exc), args])
```

For our ETL: failed tickers are logged to `etl_runs` with `status='failed'` and `error=traceback`. That IS our DLQ — queryable, persistent, inspectable.

---

## 3. Concurrency & Worker Configuration

### Concurrency based on task type
Our ETL tasks are **I/O bound** (API calls, DB writes):

```bash
# I/O bound: 2x-4x cores
# 4-core machine → 8-16 concurrent workers
celery -A celery_app worker --concurrency=8
```

CPU-bound tasks (ML inference, data transformation): use `--concurrency=num_cores`.

### Prefetch multiplier
Default is 4 — each worker pre-fetches 4 tasks. For long tasks this means idle workers wait while 4 tasks are locked to one busy worker.

```python
# For tasks > 5 seconds, set to 1
app.conf.worker_prefetch_multiplier = 1
```

Reduces average queue wait by ~40% for slow tasks.

### `-Ofair` flag
Distribute tasks only to free workers, never to busy ones:
```bash
celery -A celery_app worker --concurrency=8 -Ofair
```

### Memory management — recycle workers
Long-running Python processes leak memory. Recycle worker processes after N tasks:

```python
app.conf.worker_max_tasks_per_child = 200  # recycle after 200 tasks
```

Essential for production stability when tasks involve pandas/numpy (memory-heavy libraries).

---

## 4. Error Handling & Retries

### Exponential backoff with jitter
```python
@app.task(
    bind=True,
    max_retries=3,
    autoretry_for=(requests.exceptions.RequestException, ConnectionError),
    retry_backoff=True,          # 2s, 4s, 8s
    retry_backoff_max=60,        # cap at 60s
    retry_jitter=True,           # randomize ±10% to prevent thundering herd
)
def fetch_news(self, ticker):
    ...
```

### Only retry on transient errors
```python
# Good — only retry network/timeout errors
autoretry_for=(requests.Timeout, requests.ConnectionError)

# Bad — retrying ValueError just keeps failing
autoretry_for=(Exception,)  # catches logic errors, never succeeds
```

### Circuit breaker per ticker
Track consecutive failures per ticker. After 3 failures, skip for the rest of the run:

```python
def should_skip_ticker(ticker: str, db) -> bool:
    recent_failures = db.execute("""
        SELECT COUNT(*) FROM etl_runs
        WHERE ticker = %s AND status = 'failed'
        AND run_at > NOW() - INTERVAL '1 hour'
    """, [ticker]).scalar()
    return recent_failures >= 3
```

### Never catch bare `Exception` silently
```python
# Bad — swallows errors, pipeline appears healthy when it's not
try:
    ingest_prices(ticker)
except Exception:
    pass

# Good — log the error, let retry handle it
try:
    ingest_prices(ticker)
except Exception as e:
    log_etl_run(ticker, "prices", "failed", error=str(e))
    raise  # re-raise so Celery can retry
```

---

## 5. Celery Beat Scheduler

### Run exactly ONE Beat instance
Multiple Beat instances = duplicate task scheduling. In Docker Compose, ensure only one `beat` service:

```yaml
services:
  worker:
    command: celery -A celery_app worker --loglevel=info

  beat:
    command: celery -A celery_app beat --loglevel=info
    # Never scale this: deploy: replicas: 1
```

### Use PersistentScheduler (default)
Survives restarts without duplicating scheduled tasks. Stores schedule state in `celerybeat-schedule` file.

```python
app.conf.beat_scheduler = "celery.beat.PersistentScheduler"
app.conf.beat_schedule_filename = "/app/data/celerybeat-schedule"
```

Map this file to a Docker volume so it persists across container restarts.

### Schedule design for FinancialAgent
```python
from celery.schedules import crontab
from datetime import timedelta

app.conf.beat_schedule = {
    # News: every 30 min (fastest-changing data)
    "news-every-30min": {
        "task": "tasks.news.run_all",
        "schedule": timedelta(minutes=30),
    },
    # Prices: daily at 21:00 UTC (4 PM EST + 1h buffer for market close)
    "prices-daily": {
        "task": "tasks.prices.run_all",
        "schedule": crontab(hour=21, minute=0),
    },
    # SEC Filings: daily at 22:00 UTC
    "filings-daily": {
        "task": "tasks.filings.run_all",
        "schedule": crontab(hour=22, minute=0),
    },
    # Financials: weekly Sunday 02:00 UTC (low-traffic window)
    "financials-weekly": {
        "task": "tasks.financials.run_all",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),
    },
}
```

### Bootstrap on startup
Run an immediate ETL when the worker first starts so the DB has data without waiting for the first scheduled run:

```python
@app.on_after_configure.connect
def bootstrap(sender, **_):
    sender.send_task("tasks.pipeline.run_bootstrap")
```

---

## 6. Serialization

### Always use JSON (never Pickle in production)
```python
app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],    # whitelist only JSON — blocks Pickle injection attacks
)
```

Pickle can execute arbitrary code during deserialization. Never use it unless your broker is completely isolated from untrusted access.

### What this means for task arguments
Only pass JSON-serializable types between tasks: `str`, `int`, `float`, `bool`, `list`, `dict`, `None`.

```python
# Bad — pandas DataFrame is not JSON serializable
fetch_prices.delay(df)

# Good — pass the ticker, load data inside the task
fetch_prices.delay("AAPL")
```

---

## 7. Monitoring

### Flower (web UI for Celery)
Real-time task monitoring: active tasks, queue depth, worker status, task history.

```yaml
# docker-compose.yml
flower:
  image: mher/flower
  command: celery -A celery_app flower --port=5555
  ports:
    - "5555:5555"
```

Access at `http://localhost:5555`. Shows queue depth, active/reserved/failed tasks per worker.

### Key metrics to watch
| Metric | Healthy | Alert |
|---|---|---|
| Queue depth | < 50 tasks | > 200 tasks (backlog) |
| Task success rate | > 95% | < 90% |
| Worker memory | < 80% | > 90% |
| Task latency p95 | < pipeline SLA | > 2× SLA |
| Beat scheduler alive | yes | not seen in > 1 scheduled interval |

### ETL observability via `etl_runs` table
Query the database for pipeline health:
```sql
-- Last run status per pipeline
SELECT pipeline, status, COUNT(*), MAX(run_at)
FROM etl_runs
WHERE run_at > NOW() - INTERVAL '24 hours'
GROUP BY pipeline, status;

-- Slowest tickers
SELECT ticker, AVG(duration_ms) as avg_ms
FROM etl_runs WHERE status = 'success'
GROUP BY ticker ORDER BY avg_ms DESC LIMIT 10;

-- Recent failures
SELECT ticker, pipeline, error, run_at
FROM etl_runs WHERE status = 'failed'
ORDER BY run_at DESC LIMIT 20;
```

---

## 8. Result Backend

### Use Redis as result backend (what we use)
```python
app.conf.result_backend = settings.REDIS_URL
app.conf.result_expires = 3600  # expire results after 1 hour
```

For ETL tasks, we don't query task results directly — all output goes to Postgres via `etl_runs`. Redis backend is used only for task state tracking (PENDING/STARTED/SUCCESS/FAILURE).

### Don't store large results in Redis
```python
# Bad — stores entire DataFrame in Redis
@app.task
def fetch_prices():
    return df.to_dict()  # could be MBs

# Good — store in Postgres, return only a status
@app.task
def fetch_prices(ticker):
    rows = _fetch(ticker)
    _insert(rows)
    return {"ticker": ticker, "rows": len(rows), "status": "ok"}
```

---

## What we implement in FinancialAgent

| Practice | Implemented | How |
|---|---|---|
| Atomic tasks (one responsibility) | ✅ | Separate task per pipeline per ticker |
| Idempotent upserts | ✅ | `ON CONFLICT DO UPDATE` everywhere |
| `acks_late=True` | ✅ | All ETL tasks |
| Exponential backoff | ✅ | `retry_backoff=True` + jitter |
| Circuit breaker per ticker | ✅ | Failure count query in `etl_runs` |
| Multiple queues | ✅ | `realtime`, `daily`, `batch` |
| DLQ via `etl_runs` | ✅ | `status='failed'` rows are queryable DLQ |
| Single Beat instance | ✅ | Docker Compose enforces one `beat` service |
| PersistentScheduler | ✅ | Beat schedule file volumed to host |
| Bootstrap on startup | ✅ | `@app.on_after_configure.connect` |
| JSON serialization only | ✅ | `accept_content=['json']` |
| `worker_max_tasks_per_child` | ✅ | Set to 200 (pandas memory management) |
| `worker_prefetch_multiplier=1` | ✅ | I/O bound tasks |
| Flower monitoring | ✅ | Docker Compose service on port 5555 |
| ETL observability | ✅ | `etl_runs` table surfaced in UI |
