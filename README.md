# EquityAgent — AI-Powered Stock Research Platform

A full-stack financial research application that runs a **multi-agent AI pipeline** to generate structured equity research reports. Type a ticker, get a complete analyst-grade brief in under 20 seconds.

**Live stack:** Next.js · FastAPI · LangGraph · PostgreSQL · Redis · Celery · Docker

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                               │
│                         Next.js Frontend                            │
│   Ticker Tape · Price Chart · Market Data · DCF · Portfolio · Chat  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP / SSE (streaming)
┌──────────────────────────▼──────────────────────────────────────────┐
│                      FastAPI Backend  :8000                          │
│                                                                     │
│   /api/research  ──────────►  LangGraph Agent Pipeline              │
│   /api/tools/*   ──────────►  Tool Layer                            │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │              LangGraph Multi-Agent Pipeline              │       │
│   │                                                         │       │
│   │   [introspect]                                          │       │
│   │        │                                                │       │
│   │        ▼  (parallel fan-out)                            │       │
│   │   ┌────┴────────────────────┐                           │       │
│   │   │  market_researcher      │  price, technicals        │       │
│   │   │  fundamental_researcher │  financials, filings      │       │
│   │   │  sentiment_researcher   │  news, sentiment score    │       │
│   │   └────┬────────────────────┘                           │       │
│   │        │  (fan-in, parallel synthesis)                  │       │
│   │   ┌────┴────────────────────┐                           │       │
│   │   │  analyst (bull)         │                           │       │
│   │   │  bear_analyst           │                           │       │
│   │   └────┬────────────────────┘                           │       │
│   │        ▼                                                │       │
│   │   [critic]  →  [writer]  →  ResearchResult JSON        │       │
│   └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│   Tool Layer                                                        │
│   ├── prices.py       Yahoo Finance v8 chart (no auth required)     │
│   ├── financials.py   SEC EDGAR XBRL API → yfinance fallback        │
│   ├── companies.py    PostgreSQL watchlist table                    │
│   ├── news.py         PostgreSQL news_articles table                │
│   ├── filings.py      PostgreSQL sec_filings table                  │
│   ├── metrics.py      Derived ratios (ROE, margins, etc.)           │
│   └── edgar.py        SEC EDGAR XBRL — free, no API key             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼──────┐ ┌───────▼──────┐ ┌──────▼──────────────────┐
│   PostgreSQL   │ │    Redis     │ │   Celery Worker + Beat  │
│                │ │              │ │                         │
│  companies     │ │  Task broker │ │  tasks.news   (every N  │
│  news_articles │ │  Result cache│ │    min) — fetch & store │
│  sec_filings   │ │              │ │  tasks.filings (daily)  │
│  research_runs │ │              │ │  tasks.companies(daily) │
└────────────────┘ └──────────────┘ └─────────────────────────┘

External APIs (no auth required / free tier):
  Yahoo Finance v8 chart  →  real-time OHLCV prices
  SEC EDGAR XBRL API      →  10-K financials, EPS, shares outstanding
  SEC EDGAR submissions   →  recent 10-K / 10-Q / 8-K filings
  Groq API                →  LLM inference (llama-3.1-8b-instant)
```

---

## Features

| Feature | Description |
|---|---|
| **AI Research Report** | 7-agent LangGraph pipeline produces executive brief, bull/bear analysis, critic review |
| **Live Price Data** | Real-time OHLCV from Yahoo Finance v8, batch-fetched for ticker tape |
| **Candlestick Chart** | LINE / OHLC toggle, MA50, MA200, RSI(14) sub-panel |
| **Fundamental Data** | Revenue, net income, EPS, FCF, debt — 4 years from SEC EDGAR |
| **DCF Valuation** | Interactive model — adjust growth rate, WACC, terminal growth; instant intrinsic value |
| **Portfolio Tracker** | Add holdings, track unrealized P&L and return %, allocation pie chart, persisted in localStorage |
| **Peer Comparison** | Side-by-side price and valuation metrics for sector peers |
| **SEC Filings** | Latest 10-K, 10-Q, 8-K with direct EDGAR links |
| **News Sidebar** | Live news from scheduled Celery ingest, stored in Postgres |
| **Research History** | All runs stored, shareable permalink at `/r/{id}` |
| **Chat Panel** | Follow-up questions on any research result |
| **Score Radar** | Radar chart scoring fundamentals, sentiment, technicals, risk |

---

## Tech Stack

**Backend**
- Python 3.11, FastAPI, Uvicorn
- LangGraph 0.1 + LangChain (Groq provider)
- yfinance, requests (Yahoo Finance v8 chart)
- SEC EDGAR XBRL API (no API key — public government endpoint)
- psycopg2, PostgreSQL 16
- Celery 5 + Redis 7 (task queue + beat scheduler)

**Frontend**
- Next.js 14 (App Router, standalone output)
- React 18, TypeScript
- Recharts (area chart, candlestick, sparklines, radar, pie)
- Server-side rewrites to backend (no CORS issues)

**Infrastructure**
- Docker Compose — 6 services (postgres, redis, worker, beat, backend, frontend)
- Celery Flower at `:5555` for task monitoring
- Health checks on postgres and redis before dependent services start

---

## Quickstart

```bash
# 1. Clone and configure
git clone <repo>
cd FinancialAgent
cp .env.example .env
# Edit .env — set GROQ_API_KEY and database credentials

# 2. Start everything
docker compose up --build

# 3. Open
#   App:    http://localhost:3000
#   API:    http://localhost:8000/docs
#   Flower: http://localhost:5555
```

**.env minimum required:**
```env
GROQ_API_KEY=your_key_here
POSTGRES_USER=finagent
POSTGRES_PASSWORD=finagent
POSTGRES_DB=finagent
```

---

## Project Structure

```
FinancialAgent/
├── backend/
│   ├── agent/          # LangGraph nodes and graph definition
│   ├── api/            # FastAPI routers (research, tools)
│   ├── tools/          # Data tools (prices, financials, edgar, news…)
│   ├── core/           # Config (pydantic-settings)
│   └── main.py         # FastAPI app entry point
├── frontend/
│   ├── app/            # Next.js App Router pages
│   ├── components/     # All UI components (22 components)
│   └── lib/            # Shared types and API base URL
├── worker/
│   ├── tasks/          # Celery tasks (news, filings, companies, pipeline)
│   └── celery_app.py   # Beat schedule + worker config
└── docker-compose.yml
```

---

## Data Sources

| Data | Source | Auth needed? |
|---|---|---|
| Real-time price, OHLCV | Yahoo Finance v8 chart API | No |
| Annual financials (revenue, EPS, FCF) | SEC EDGAR XBRL API | No |
| SEC filings (10-K, 10-Q, 8-K) | SEC EDGAR submissions API | No |
| News articles | Yahoo Finance RSS via Celery worker | No |
| LLM inference | Groq API (llama-3.1-8b-instant) | API key |

All financial data comes from US government SEC filings — accurate, free, and not subject to rate limiting.

---

## Known Limitations

- `avg_volume`, `dividend_yield`, `beta`, `forward_pe` show `—` — these require Yahoo Finance's authenticated API which blocks Docker container IPs
- EDGAR fundamentals are annual (10-K) only; quarterly data falls back to yfinance which may also be blocked in Docker
- LLM quality depends on Groq rate limits; switch `LLM_QUALITY_MODEL` to `llama-3.3-70b-versatile` when not rate-limited
