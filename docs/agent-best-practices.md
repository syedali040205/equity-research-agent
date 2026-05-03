# LLM Agent Best Practices (Production Grade)

> Consolidated from LangGraph docs, Anthropic agent docs, LangChain blog, Galileo, n8n, LeewayHertz.
> Reference for the FinancialAgent multi-agent graph design decisions.

---

## 1. Architecture Patterns

### Supervisor pattern (what we use)
A supervisor agent coordinates specialized worker agents. Each worker has its own system prompt, tools, and responsibility boundary.

```
Supervisor
├── Researcher Agent    (fetches raw data)
├── Analyst Agent       (interprets, calculates)
├── Critic Agent        (fact-checks)
└── Writer Agent        (composes final brief)
```

**Why supervisor over linear chain:**
- Supervisor can route to multiple agents in parallel (lower latency)
- Supervisor can request revisions ("analyst output is incomplete, retry")
- Each agent is independently testable and replaceable
- Clear routing decisions are logged and auditable

### Hierarchical teams (for scale)
For complex workflows: top-level supervisor → mid-level supervisors → worker agents. We don't need this for MVP but it's the natural extension.

### Key architecture rules
- **One responsibility per agent** — Analyst only analyzes, Writer only writes. Never combine.
- **Agents communicate through state** — never call each other directly.
- **Supervisor owns routing decisions** — workers never decide what happens next.

---

## 2. State Management (LangGraph)

### Use explicit TypedDict schemas
```python
class ResearchState(TypedDict, total=False):
    ticker: str
    company_name: str
    raw_prices: dict
    raw_financials: dict
    raw_news: list
    raw_filings: str
    analysis: str
    critique: list
    brief: str
    confidence_score: float
    sources_cited: int
    retry_count: int
    error_history: list[str]
```

Never use `dict` or untyped state — type errors surface at runtime in LangGraph, not at definition.

### Reducers for list fields
```python
from typing import Annotated
import operator

class ResearchState(TypedDict):
    error_history: Annotated[list, operator.add]  # appends, not overwrites
    sources: Annotated[list, operator.add]
```

Without reducers, parallel agents overwrite each other's state updates.

### Checkpointing
Persist state to Postgres after each node. Benefits:
- Resume interrupted workflows
- Inspect any past run for debugging
- Enable human-in-the-loop (pause before writing)

### State isolation
Each agent node returns ONLY the keys it modified. A researcher node returns `{"raw_news": [...]}`, not the entire state. Prevents accidental overwrites.

---

## 3. Tool Design

### Validate inputs before execution
```python
def fetch_financials(ticker: str) -> dict:
    if not ticker or len(ticker) > 10:
        return {"error": "Invalid ticker format"}
    if ticker not in WATCHLIST:
        return {"error": f"Ticker {ticker} not in watchlist"}
    # proceed with fetch
```

Return structured error messages the LLM can reason about. Silent failures (returns None, agent doesn't notice) are the most common production failure mode.

### Specific tools over generic tools
Bad: `write_to_state(key, value)` — LLM can write anything anywhere
Good: `save_analysis(analysis_text)` — constrained, clear intent

Specific tools reduce the surface area for the LLM to make mistakes.

### Tools return structured data
```python
# Bad — LLM has to parse free text
return "Revenue was $60.9B, up 122% YoY"

# Good — LLM gets structured data it can reason about
return {
    "revenue": 60900000000,
    "revenue_growth_yoy": 1.22,
    "period": "TTM",
    "source": "yfinance"
}
```

### Tool calling vs ReAct
| Approach | When to use |
|---|---|
| **Native tool calling** (what we use) | Speed, reliability, structured outputs. Modern LLMs handle this natively. |
| **ReAct (Reason + Act)** | Complex multi-hop reasoning where you need to see the thought process |

For financial data fetching (deterministic, structured), native tool calling is correct.

---

## 4. Prompt Engineering for Agents

### System prompt structure
```
1. Role definition — who is this agent
2. Context — what data it has access to
3. Task — what it must produce
4. Output format — exact JSON schema with example
5. Constraints — what it must NOT do
6. Quality bar — what "done well" looks like
```

### Always request structured JSON output
```python
ANALYST_PROMPT = """You are a financial analyst. Given raw financial data, produce a structured analysis.

Output EXACTLY this JSON (no markdown fences, no extra text):
{
  "revenue_trend": "growing|declining|stable",
  "margin_health": "strong|moderate|weak",
  "key_metrics": {"pe_ratio": float, "net_margin": float, "fcf_yield": float},
  "strengths": ["...", "..."],
  "risks": ["...", "..."],
  "one_line_summary": "..."
}
"""
```

JSON output reduces parsing errors by ~60% vs free-text. Use `response_format={"type": "json_object"}` where supported.

### Include examples in system prompts
Few-shot examples dramatically improve structured output adherence. One good example is worth 500 words of instruction.

### Separate system prompt from user data
```python
# System prompt: static, describes the agent's role
# Human message: dynamic, contains the actual data for this run
```

This enables prompt caching — the static system prompt is cached, only the dynamic data costs tokens.

---

## 5. Self-Correction Loop

### Critic agent design
The critic receives the analyst's output and checks:
- Are all numbers traceable to a source?
- Does any claim contradict the raw data?
- Are all required fields populated?

```python
CRITIC_PROMPT = """You are a financial fact-checker. Check the analyst's output against the raw data.

For each claim, verify: is this number present in the raw data provided?
Return:
{
  "passed": bool,
  "issues": [{"claim": "...", "actual_value": "...", "severity": "critical|minor"}],
  "corrected_values": {"field_name": corrected_value}
}
"""
```

### Retry routing
```python
def route_after_critic(state: ResearchState) -> str:
    issues = state.get("critique", [])
    critical = [i for i in issues if i["severity"] == "critical"]
    retries = state.get("retry_count", 0)

    if critical and retries < 2:
        return "analyst"      # retry with corrections
    return "writer"           # proceed (minor issues or max retries)
```

### Error history accumulation
```python
# Always APPEND to error_history, never overwrite
return {
    "error_history": [f"Attempt {retry}: {error_msg}"],  # reducer appends
    "retry_count": state["retry_count"] + 1
}
```

---

## 6. Structured Output

### Enforce schema at the application layer
Don't trust the LLM to always return valid JSON. Always parse and validate:

```python
import json
from jsonschema import validate

def parse_agent_output(raw: str, schema: dict) -> dict:
    try:
        data = json.loads(raw)
        validate(data, schema)
        return data
    except json.JSONDecodeError:
        # Extract JSON from text if LLM wrapped it
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise
    except ValidationError as e:
        raise ValueError(f"Schema validation failed: {e.message}")
```

### Strip code fences
LLMs frequently wrap JSON in markdown despite being told not to:
```python
def strip_fences(text: str) -> str:
    text = re.sub(r'^```[a-zA-Z]*\n?', '', text.strip())
    text = re.sub(r'\n?```$', '', text)
    return text.strip()
```

---

## 7. Observability for Agents

### Log every LLM call
```python
{
  "timestamp": "2026-05-03T10:00:00Z",
  "agent": "analyst",
  "ticker": "NVDA",
  "model": "llama3.1:8b",
  "prompt_tokens": 1240,
  "completion_tokens": 380,
  "latency_ms": 8200,
  "success": true,
  "retry_count": 0
}
```

Store in `agent_runs` table. Surface in eval dashboard.

### Key metrics per agent run
| Metric | Target |
|---|---|
| End-to-end latency | < 60s per brief |
| LLM call success rate | > 95% |
| Critic pass rate | > 80% first attempt |
| Retry rate | < 20% |
| Structured output parse success | > 98% |

### Trace the full execution path
Every brief generation should produce a trace:
```
Supervisor (12ms) → [Researcher×3 parallel] (2.1s) → Analyst (18s) →
Critic (12s, 1 issue found) → Analyst retry (14s) → Writer (9s)
Total: 55s | Retries: 1 | Confidence: 88%
```
Show this in the UI transparency panel.

---

## 8. Evaluation (the differentiator)

### Automated factual accuracy eval
```python
def eval_numerical_accuracy(brief: dict, ground_truth: dict) -> float:
    fields = ["revenue", "net_income", "pe_ratio", "net_margin", "market_cap"]
    scores = []
    for field in fields:
        if field not in brief or field not in ground_truth:
            scores.append(0)
            continue
        ratio = brief[field] / ground_truth[field]
        scores.append(1.0 if 0.95 <= ratio <= 1.05 else 0.0)  # ±5% tolerance
    return sum(scores) / len(scores)
```

### Coverage eval
Did the brief populate all required sections?
```python
REQUIRED_SECTIONS = ["executive_summary", "financial_snapshot",
                     "key_developments", "analyst_assessment", "risk_factors"]

def eval_coverage(brief: dict) -> float:
    populated = sum(1 for s in REQUIRED_SECTIONS if brief.get(s))
    return populated / len(REQUIRED_SECTIONS)
```

### Run benchmark on 30 tickers
```python
results = []
for ticker in WATCHLIST_30:
    brief = generate_brief(ticker)
    truth = fetch_ground_truth(ticker)
    results.append({
        "ticker": ticker,
        "accuracy": eval_numerical_accuracy(brief, truth),
        "coverage": eval_coverage(brief),
        "latency_s": brief["generation_time_s"],
    })
# Aggregate and display in eval dashboard
```

---

## 9. Cost & Latency Optimization

### Parallel research (biggest win)
Run all three researchers simultaneously, not sequentially:
```python
# LangGraph parallel branches
workflow.add_node("research_prices", research_prices)
workflow.add_node("research_financials", research_financials)
workflow.add_node("research_news", research_news)

# All three run in parallel from the supervisor
workflow.add_edge("supervisor", "research_prices")
workflow.add_edge("supervisor", "research_financials")
workflow.add_edge("supervisor", "research_news")
```
3 sequential calls at 5s each = 15s. 3 parallel calls = 5s. 3× speedup.

### Prompt caching
Static system prompts (role definition, output schema, financial concepts) are identical across every brief generation. Cache them:
```python
# Anthropic: use cache_control on system prompt
# Ollama: system prompt is cached automatically on warm model
```

### Cap output tokens
Each agent needs only its specific output. Set tight limits:
- Researcher: 300 tokens (structured JSON)
- Analyst: 500 tokens
- Critic: 200 tokens
- Writer: 800 tokens (longest output)

### num_ctx sizing
Financial analysis prompts are ~1500-2000 tokens with data. Set `num_ctx=3000` — enough headroom without wasting VRAM on unused context.

---

## What we implement in FinancialAgent

| Practice | Implemented | How |
|---|---|---|
| Supervisor pattern | ✅ | LangGraph supervisor node routes to specialists |
| TypedDict state with reducers | ✅ | `ResearchState` with `Annotated` list fields |
| Structured JSON output | ✅ | All agents output JSON, parsed + validated |
| Self-correction loop | ✅ | Critic → Analyst retry, max 2 retries |
| Error history accumulation | ✅ | Reducer appends, never overwrites |
| Tool input validation | ✅ | Every tool validates before API call |
| Parallel research | ✅ | LangGraph parallel branches |
| Agent run logging | ✅ | `agent_runs` table, surfaced in dashboard |
| Automated evals | ✅ | 30-ticker benchmark with numerical accuracy |
| Structured output parsing | ✅ | JSON extract + schema validation + fence stripping |
