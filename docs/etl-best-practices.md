# ETL Pipeline Best Practices (Production Grade)

> Consolidated from Netflix, Uber, Airbnb, Stripe engineering blogs + dbt, Great Expectations, Kafka, Airflow docs.
> Reference for the FinancialAgent ETL pipeline design decisions.

---

## 1. Data Ingestion Patterns

### Choose the right load strategy

| Strategy | How it works | When to use |
|---|---|---|
| **Full load** | Re-fetch everything every run | Small tables, source has no timestamps |
| **Timestamp watermarking** | Store `max(updated_at)` from last run, fetch only newer rows | Most common, simple APIs |
| **Hash comparison** | MD5 all columns, compare fingerprints | Compliance audits, subtle change detection |
| **CDC (Change Data Capture)** | Tap source DB transaction log (WAL/binlog) | Mission-critical, near-real-time |

**We use: Timestamp watermarking** — store last successful fetch timestamp per ticker per pipeline in `etl_runs`, query only newer data on next run.

### Watermarking implementation
```sql
-- Control table stores high-watermark per pipeline
SELECT MAX(run_at) FROM etl_runs
WHERE ticker = 'AAPL' AND pipeline = 'news' AND status = 'success'
-- Next run fetches news published_at > that timestamp
```

### Key ingestion rules
- Never assume the source API is reliable — design for failure
- Prefer many small fetches over one large fetch (easier to retry)
- Always record what you fetched and when (→ `etl_runs` table)

---

## 2. Error Handling

### Exponential backoff on API failures
```
Attempt 1 → fail → wait 2s
Attempt 2 → fail → wait 4s
Attempt 3 → fail → wait 8s
After N failures → mark as 'failed' in etl_runs, move on
```
Never retry indefinitely. Capped retries prevent infinite loops.

### Circuit breaker per ticker
If a ticker fails 3 consecutive runs, mark it `skipped` and stop calling its APIs until manually reset. One delisted ticker (e.g., SIVB) shouldn't stall 19 others.

### Dead letter pattern
Failed rows go to `etl_errors` table (or just logged in `etl_runs.error`). Don't discard silently, don't block the pipeline. Review manually, reprocess selectively.

### Graceful partial success
Each ticker is independent. If TSLA news fails, AAPL news still succeeds.
Final run status:
- `success` — all tickers OK
- `partial` — some tickers failed, others succeeded
- `failed` — complete failure (DB down, auth error)

---

## 3. Idempotency (Exactly-Once Loads)

**Rule: Re-running the same ETL twice must produce the same result.**

### Implementation: upsert on natural primary key
```sql
INSERT INTO daily_prices (ticker, date, close, volume, ...)
VALUES (...)
ON CONFLICT (ticker, date)
DO UPDATE SET
    close = EXCLUDED.close,
    volume = EXCLUDED.volume,
    updated_at = NOW();
```

### Test idempotency explicitly
```python
def test_idempotent_load():
    load_prices("AAPL")
    count_1 = get_row_count("daily_prices", ticker="AAPL")
    load_prices("AAPL")  # run again
    count_2 = get_row_count("daily_prices", ticker="AAPL")
    assert count_1 == count_2  # no duplicates
```

### Transactional writes
Wrap each ticker's load in a DB transaction. If anything fails mid-insert, the whole ticker's batch rolls back. Never leave partial data.

```python
with conn.transaction():
    conn.execute("DELETE FROM daily_prices WHERE ticker = %s AND date = %s", ...)
    conn.execute("INSERT INTO daily_prices ...", ...)
```

---

## 4. Data Quality & Validation

**Validate before writing to the warehouse. Never let garbage propagate downstream.**

### Three layers of validation

**Layer 1: Schema validation** (did the API return what we expected?)
- All required fields present
- Correct data types (price is numeric, date is date)
- No unexpected nulls on critical fields

**Layer 2: Business rule validation** (does the data make sense?)
- Revenue must be positive
- Close price must be > 0
- Date must not be in the future
- P/E ratio must be between -1000 and 10000

**Layer 3: Statistical anomaly detection** (is it unusually different from history?)
- Alert if daily volume is > 3 standard deviations from 30-day average
- Alert if row count drops > 20% from baseline

### Validation outcome
- Pass → insert to warehouse
- Fail (schema/business rule) → reject row, log to `etl_runs.error`, increment `rows_rejected`
- Fail (anomaly) → insert but flag with `quality_flag = 'anomaly'`, alert

### Tools used in industry
- **Great Expectations** — define expectations as code, auto-generate reports
- **dbt tests** — `unique`, `not_null`, `accepted_values`, `relationships`
- **Soda Core** — lightweight alternative to Great Expectations

---

## 5. Observability

**You cannot operate a pipeline you cannot see.**

### The `etl_runs` table (our observability backbone)
Every pipeline, every ticker, every run gets a row:
```sql
etl_runs (
    id            SERIAL PK,
    run_at        TIMESTAMP,
    ticker        VARCHAR,
    pipeline      VARCHAR,   -- 'prices' | 'financials' | 'news' | 'filings'
    status        VARCHAR,   -- 'success' | 'failed' | 'skipped' | 'partial'
    rows_upserted INTEGER,
    rows_rejected INTEGER,
    duration_ms   INTEGER,
    error         TEXT
)
```

### Key metrics to surface in the dashboard
| Metric | SLA | Alert condition |
|---|---|---|
| **Freshness** | Prices: < 24h old | > 26h since last success |
| **Completeness** | > 95% tickers OK per run | < 90% success rate |
| **Latency p95** | < 5 min full pipeline | > 8 min |
| **Row count drift** | ± 10% vs prior run | > 20% drop |
| **Error rate** | < 5% rows rejected | > 10% rejection |

### Data lineage principle
Every row in the warehouse must be traceable to:
- Which ETL run loaded it (`ingested_at`, `etl_run_id`)
- Which source system it came from (`source = 'yfinance'`)
- When the source said it was last updated

---

## 6. Schema Design

### Audit columns on every table (mandatory)
```sql
created_at   TIMESTAMP NOT NULL DEFAULT NOW(),   -- when first inserted
updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),   -- when last updated
source       VARCHAR NOT NULL,                   -- 'yfinance' | 'edgar' | 'rss'
ingested_at  TIMESTAMP NOT NULL DEFAULT NOW()    -- when our ETL ran
```

### Staging → Warehouse pattern
```
Source API
    ↓ (extract, minimal transform)
staging_* tables   ← raw, matches source schema closely
    ↓ (validate, clean, enrich)
warehouse tables   ← production, query-optimized
```

Staging tables are temporary and can be truncated/recreated. Warehouse tables are permanent and audited.

### SCD Type 2 for slowly changing data
When a company's name, sector, or industry changes, keep history:
```sql
companies (
    surrogate_id   SERIAL PK,
    ticker         VARCHAR,
    name           VARCHAR,
    sector         VARCHAR,
    effective_from DATE,
    effective_to   DATE,         -- 9999-12-31 for current
    is_current     BOOLEAN
)
```

For financial data, we use simpler **upsert with updated_at** since we care about current state, not full history.

### Primary key strategy
| Table | Primary Key | Why |
|---|---|---|
| `companies` | `ticker` | Unique business identifier |
| `daily_prices` | `(ticker, date)` | One price per ticker per day |
| `financials` | `(ticker, period, period_type)` | One statement per period |
| `news_articles` | `url` | Articles are unique by URL |
| `sec_filings` | `filing_url` | Filings are unique by URL |

---

## 7. Pipeline Orchestration

### Tool choice
| Tool | Best for | We use? |
|---|---|---|
| **Airflow** | Complex DAGs, 200K+ pipelines (Uber), rich ecosystem | No (overkill for student project) |
| **Prefect** | Python-native teams, simpler than Airflow | No |
| **Celery + Beat** | Background tasks, simple scheduling, FastAPI-native | ✅ Yes |
| **cron** | Simple scripts, no dependencies | Fallback |

**We use Celery + Beat** — fits naturally with our FastAPI backend, minimal ops overhead, already familiar from prior project.

### Task isolation principle
Each Celery task does ONE thing:
- `ingest_prices` only fetches prices
- `ingest_news` only fetches news
- `run_full_pipeline` only coordinates the others

Never combine extract + transform + load in one function. Separate concerns = easier to debug, test, and retry individually.

### Schedule design
```python
beat_schedule = {
    "prices-daily":     {"task": "tasks.prices.run",     "schedule": crontab(hour=21, minute=0)},
    "financials-weekly":{"task": "tasks.financials.run", "schedule": crontab(day_of_week=0, hour=2)},
    "news-30min":       {"task": "tasks.news.run",       "schedule": timedelta(minutes=30)},
    "filings-daily":    {"task": "tasks.filings.run",    "schedule": crontab(hour=22, minute=0)},
}
```

---

## 8. Testing ETL Pipelines

### Three-layer testing strategy

**Layer 1: Unit tests** — test transform functions in isolation
```python
def test_calculate_margin():
    row = {"revenue": 100, "net_income": 25}
    assert calculate_margin(row) == 0.25

def test_invalid_price_rejected():
    row = {"ticker": "AAPL", "close": -5.0}
    assert validate_price(row) == False
```

**Layer 2: Integration tests** — test against a real test DB
```python
def test_prices_pipeline_end_to_end(test_db):
    run_prices_pipeline("AAPL", db=test_db)
    rows = test_db.execute("SELECT * FROM daily_prices WHERE ticker='AAPL'")
    assert len(rows) > 0
    assert rows[0]["close"] > 0
```

**Layer 3: Idempotency tests** — verify re-runs don't duplicate
```python
def test_prices_idempotent(test_db):
    run_prices_pipeline("AAPL", db=test_db)
    count_1 = test_db.count("daily_prices", ticker="AAPL")
    run_prices_pipeline("AAPL", db=test_db)
    count_2 = test_db.count("daily_prices", ticker="AAPL")
    assert count_1 == count_2
```

### What we test in FinancialAgent
- [ ] Each transform function (unit)
- [ ] Validation rejects bad rows (unit)
- [ ] Idempotent upserts (integration)
- [ ] ETL run is logged to `etl_runs` (integration)
- [ ] Circuit breaker fires after N failures (unit)
- [ ] Full pipeline produces data the agent can query (e2e)

---

## What we implement in FinancialAgent

| Practice | Implemented | How |
|---|---|---|
| Watermark-based incremental load | ✅ | `etl_runs` high-watermark per ticker/pipeline |
| Exponential backoff | ✅ | `@retry` decorator with backoff |
| Circuit breaker per ticker | ✅ | Failure counter in `etl_runs` |
| Idempotent upserts | ✅ | `ON CONFLICT DO UPDATE` everywhere |
| Data validation (schema + business rules) | ✅ | `utils/validation.py` before every insert |
| Observability table | ✅ | `etl_runs` table, surfaced in UI |
| Graceful partial success | ✅ | Per-ticker exception handling |
| Audit columns | ✅ | `source`, `ingested_at` on all tables |
| Task isolation | ✅ | Separate Celery task per pipeline |
| Transactional writes | ✅ | `with conn.transaction()` per ticker batch |
| Unit tests | ✅ | `tests/` folder |

---

## Sources

- [Netflix: ETL Development Lifecycle with Dataflow](https://netflixtechblog.medium.com/etl-development-life-cycle-with-dataflow-9c70c64aba7b)
- [Confluent: Exactly-Once Semantics in Kafka](https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/)
- [Estuary: CDC Done Correctly](https://estuary.dev/blog/cdc-done-correctly/)
- [Great Expectations: Data Quality Framework](https://greatexpectations.io/)
- [dbt Labs: ETL Pipeline Best Practices](https://www.getdbt.com/blog/etl-pipeline-best-practices)
- [Monte Carlo Data: Data Engineering Architecture](https://www.montecarlodata.com/blog-data-engineering-architecture/)
- [Airbyte: How to Write Test Cases for ETL Pipelines](https://airbyte.com/data-engineering-resources/how-to-write-test-cases-for-etl-pipelines-a-beginners-guide)
- [Integrate.io: ETL Frameworks 2025](https://www.integrate.io/blog/etl-frameworks-in-2025-designing-robust-future-proof-data-pipelines/)
