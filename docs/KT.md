# EquityAgent — Knowledge Transfer Document

**Project:** EquityAgent — AI-Powered Stock Research Platform  
**Author:** Syed Ali  
**Repo:** https://github.com/syedali040205/equity-research-agent  
**Live Backend:** https://equityagent-backend.onrender.com  

---

## What Is This?

EquityAgent is a full-stack financial research application. You type a stock ticker (e.g. AAPL, META, NVDA) and a multi-agent AI pipeline runs in the background — fetching live prices, reading SEC filings, analyzing news sentiment, writing a bull and bear case — and returns a structured analyst-grade research report in under 20 seconds.

Think of it as a mini Bloomberg terminal built by one person using entirely free APIs.

---

## High-Level Architecture

```
Browser (Next.js)
     │
     │ HTTP + SSE (streaming)
     ▼
FastAPI Backend (Render)
     │
     ├── LangGraph Agent Pipeline (Groq LLM)
     ├── Tool Layer (prices, financials, news, filings)
     │       ├── Yahoo Finance v8 chart (live prices)
     │       └── SEC EDGAR XBRL API (fundamentals)
     │
     └── PostgreSQL (Neon) ◄─── Celery Worker (GitHub Actions)
                                       ├── news ingestion (every 6h)
                                       ├── SEC filings (daily)
                                       └── companies bootstrap
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Recharts |
| Backend | Python 3.11, FastAPI, Uvicorn |
| AI Pipeline | LangGraph 0.1, LangChain, Groq (llama-3.1-8b-instant) |
| Database | PostgreSQL 16 (Neon — free cloud) |
| Task Queue | Celery 5 + Redis (Upstash — free cloud) |
| ETL | GitHub Actions (runs every 6h — free) |
| Data Sources | Yahoo Finance v8, SEC EDGAR XBRL, SEC EDGAR submissions |
| Deployment | Render (backend), Vercel (frontend), Neon (DB), Upstash (Redis) |

---

## Repository Structure

```
FinancialAgent/
├── backend/
│   ├── agent/
│   │   ├── graph.py          # LangGraph graph definition — wires all nodes
│   │   ├── nodes/            # One file per agent node
│   │   │   ├── analyst.py    # Bull analyst
│   │   │   ├── bear_analyst.py
│   │   │   ├── critic.py
│   │   │   └── writer.py     # Final report writer
│   │   ├── prompts.py        # All LLM prompt templates
│   │   ├── runner.py         # Runs the graph, handles streaming
│   │   └── state.py          # Shared state passed between nodes
│   ├── api/
│   │   ├── research.py       # POST /api/research — triggers pipeline
│   │   └── tools.py          # GET /api/tools/* — data endpoints
│   ├── tools/
│   │   ├── prices.py         # Live price snapshot (Yahoo v8 + EDGAR)
│   │   ├── financials.py     # Financial statements (EDGAR primary)
│   │   ├── edgar.py          # SEC EDGAR XBRL API client
│   │   ├── news.py           # News from DB
│   │   ├── filings.py        # SEC filings from DB
│   │   ├── companies.py      # Company overview from DB
│   │   └── metrics.py        # Derived ratios (ROE, margins, etc.)
│   ├── core/config.py        # Pydantic settings (reads .env)
│   ├── db.py                 # Read-only Postgres helper
│   └── main.py               # FastAPI app entry point
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # Main page — hero, loading, results screens
│   │   ├── globals.css       # CSS variables + animations
│   │   └── r/[id]/page.tsx   # Shareable research permalink
│   ├── components/           # 22 UI components
│   │   ├── PriceChart.tsx    # Line + candlestick chart, MA50/200, RSI
│   │   ├── DCFCalculator.tsx # Interactive DCF valuation model
│   │   ├── PortfolioTracker.tsx # Holdings tracker with P&L
│   │   ├── PeerComparison.tsx
│   │   ├── MarketDataPanel.tsx
│   │   ├── BullBearPanel.tsx
│   │   ├── ExecutiveBrief.tsx
│   │   └── ...
│   └── lib/
│       ├── api.ts            # Backend URL (SSR vs client)
│       └── types.ts          # Shared TypeScript types
│
├── worker/
│   ├── tasks/
│   │   ├── companies.py      # Bootstraps watchlist from SEC EDGAR
│   │   ├── news.py           # Fetches + stores news articles
│   │   ├── filings.py        # Fetches + stores SEC filings
│   │   └── pipeline.py       # Orchestrates full ETL run
│   ├── celery_app.py         # Beat schedule + worker config
│   └── db.py                 # DB connection + schema (CREATE IF NOT EXISTS)
│
├── .github/workflows/
│   └── etl.yml               # GitHub Actions — runs ETL every 6h free
├── docker-compose.yml        # Local development (all 6 services)
├── docker-compose.prod.yml   # Production (no bind mounts)
└── README.md                 # Architecture diagram + quickstart
```

---

## Agent Pipeline — How It Works

When you search a ticker, the backend opens a Server-Sent Events (SSE) stream and runs this LangGraph graph:

```
[introspect]
     │
     ├──────────────────────────────┐
     ▼                              ▼
[researcher_market]     [researcher_fundamentals]
  - Live price                - EDGAR financials
  - 52w high/low              - Revenue, margins
  - PE ratio, EPS             - EPS, FCF, debt
     │                              │
     └──────────────┬───────────────┘
                    │
          [researcher_qualitative]
            - News articles
            - SEC filings
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
      [analyst]          [bear_analyst]
      Bull case          Bear case + rebuttal
          │                   │
          └─────────┬─────────┘
                    ▼
               [critic]
           Self-critique of analysis
                    │
                    ▼
               [writer]
           Final report (HOLD/BUY/SELL)
           confidence score, thesis
```

The three researcher nodes run **in parallel** (fan-out) which reduces total time from ~60s to ~15-20s.

Each node receives the shared `AgentState` object and returns an updated version. LangGraph handles the fan-out/fan-in automatically.

---

## Data Sources — Why These Were Chosen

### Yahoo Finance v8 Chart API
- **What:** Real-time OHLCV prices, 52-week range, volume
- **Why:** No API key, no auth, works from any IP including Docker/Render
- **Endpoint:** `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}`
- **Note:** Yahoo's v7/v10 APIs require authentication and block cloud IPs — only v8 chart works reliably

### SEC EDGAR XBRL API
- **What:** Annual financials — revenue, net income, EPS, FCF, debt, equity
- **Why:** Free US government endpoint, no API key, no rate limiting, no IP blocking
- **Endpoint:** `https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json`
- **Data quality:** Sourced directly from official 10-K filings — most accurate available
- **Limitation:** Annual data only (10-K), 4 years history

### SEC EDGAR Submissions API
- **What:** Recent filings list (10-K, 10-Q, 8-K)
- **Why:** Same reasons as above, links directly to official SEC filings

### Groq API
- **What:** LLM inference for all agent nodes
- **Why:** Free tier, fast (llama-3.1-8b-instant runs in ~1s per call)
- **Model used:** `llama-3.1-8b-instant` (default), `llama-3.3-70b-versatile` (higher quality)

---

## Database Schema

Four tables in PostgreSQL (Neon):

```sql
companies       -- Watchlist: ticker, name, sector, industry, CIK, exchange
news_articles   -- Ingested news: ticker, title, summary, url, source, published_at
sec_filings     -- SEC filings: ticker, form_type, filed_at, url, description
research_runs   -- Stored research: full JSON result, ticker, timestamp, research_id
```

The backend **only reads** from the DB. Only the worker writes. This is intentional — prevents accidental data corruption from the API layer.

---

## ETL Pipeline — GitHub Actions

Since workers cost money on cloud platforms, the ETL runs as a **GitHub Actions scheduled job** (free for public repos):

- Runs every 6 hours automatically
- Can be triggered manually from the Actions tab anytime
- Connects directly to Neon using `DATABASE_URL` secret
- Runs: `init_schema()` → `bootstrap_companies()` → `run_news()` → `run_filings()`
- No Redis needed for this — runs tasks directly (not via Celery queue)

To trigger manually: GitHub repo → Actions → ETL Pipeline → Run workflow

---

## Local Development Setup

```bash
git clone https://github.com/syedali040205/equity-research-agent
cd FinancialAgent
cp .env.example .env
# Edit .env — set GROQ_API_KEY at minimum

docker compose up --build
# App:    http://localhost:3000
# API:    http://localhost:8000/docs
# Flower: http://localhost:5555
```

All 6 services start together. Worker bootstraps schema + data on first run.

---

## Known Limitations

| Issue | Reason | Workaround |
|---|---|---|
| `avg_volume`, `beta`, `dividend_yield` show `—` | Yahoo v7 API blocks cloud IPs | Would need authenticated session |
| EDGAR data is annual only | EDGAR quarterly requires different parsing | Falls back to yfinance (may also fail in cloud) |
| Free tier backend sleeps after 15min | Render free tier limitation | First request after sleep takes ~30s to wake |
| News only for watchlist tickers | Worker only fetches configured companies | Add tickers to watchlist to get news |

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Backend | Render | https://equityagent-backend.onrender.com |
| Frontend | Vercel | (add after Vercel deploy) |
| Database | Neon | ep-tiny-lab-amgxkg3z.c-5.us-east-1.aws.neon.tech |
| Redis | Upstash | noted-tick-82003.upstash.io |
| ETL | GitHub Actions | Runs every 6h |

Production env vars needed: `DATABASE_URL`, `REDIS_URL`, `GROQ_API_KEY`, `LLM_MODEL`, `SEC_USER_AGENT`

See `.env.production.example` for full reference.
