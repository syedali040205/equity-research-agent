"""LLM prompts — Groq/llama-3.1-8b-instant. No hallucination of missing data."""

SENTIMENT_PROMPT = """You are a financial news sentiment analyst.

NEWS HEADLINES for {ticker}:
{headlines}

Output JSON only:
{{
  "score": <float -1.0 to 1.0>,
  "label": "<BULLISH or BEARISH or NEUTRAL>",
  "drivers": ["<theme>", "<theme>", "<theme>"],
  "summary": "<one sentence on collective news tone for {ticker}>"
}}

Rules: JSON only. label must be BULLISH, BEARISH, or NEUTRAL exactly.
"""

ANALYST_PROMPT = """You are a senior equity research analyst. Analyze only the DATA provided below.

DATA:
{raw_data}

CRITIC FEEDBACK TO ADDRESS:
{critic_feedback}

STRICT RULES — violations will be flagged:
1. NEVER invent, estimate, or calculate numbers not present in DATA. If pe_ratio is not in DATA, do not mention a P/E ratio.
2. If revenue/margins/EPS are null or absent, say so directly — do not calculate them from other fields.
3. Use only sector/industry from DATA["company"] — do not infer competitors not mentioned.
4. key_metrics must copy exact values from DATA — null if not present.

Your analysis must:
- State clearly which data IS available and what it tells us
- State clearly which data IS NOT available and how that limits conviction
- Be specific about price vs 52w range if those values exist

Output JSON:
{{
  "thesis_one_liner": "<one sentence investment view based strictly on available data>",
  "strengths": [
    "<strength derivable from the DATA — if limited data, say what the price action suggests>",
    "<second strength or 'Limited data prevents additional strengths'>",
    "<third strength or note data gap>"
  ],
  "risks": [
    "<risk from DATA — data opacity itself is a valid risk>",
    "<second risk>",
    "<third risk>"
  ],
  "key_metrics": {{
    "revenue_growth_pct": <copy from DATA metrics.revenue_yoy_growth_pct or null>,
    "net_margin_pct": <copy from DATA metrics.net_margin_pct or null>,
    "pe_ratio": <copy from DATA price.pe_ratio or null>,
    "debt_to_equity": <copy from DATA metrics.debt_to_equity or null>
  }},
  "market_assessment": "<what price vs 52w high/low tells us — use exact values from DATA>",
  "fundamental_assessment": "<what revenue/margins tell us, OR explicitly state these are unavailable and conviction is therefore low>",
  "qualitative_assessment": "<sector position and news narrative based on available data>",
  "overall_assessment": "<honest synthesis: what we know, what we don't, and our view with appropriate uncertainty>"
}}

Output JSON only, no markdown.
"""

CRITIC_PROMPT = """You are a fact-checker for equity research.

SOURCE DATA (ground truth):
{raw_data}

ANALYSIS TO CHECK:
{analysis}

Flag any numbers in the analysis that are NOT present in SOURCE DATA. A number that appears in analysis but not in SOURCE DATA is fabricated — mark as critical.

Output JSON:
{{
  "passed": <true only if no critical or high issues>,
  "confidence": <integer 0-100>,
  "issues": [
    {{"description": "<specific problem>", "severity": "<critical|high|medium|low>"}}
  ],
  "recommendation": "<one sentence verdict>",
  "verified_count": <claims verified as correct>
}}

Rules: JSON only. severity: critical=fabricated number, high=unsupported conclusion, medium=minor gap, low=style issue.
If no issues, set issues to [].
"""

WRITER_PROMPT = """Write a research brief for {company_name} ({ticker}).

KEY FINDINGS:
- Thesis: {thesis}
- Strengths: {strengths}
- Risks: {risks}
- Market: {market_assessment}
- Overall: {overall_assessment}
- Sentiment: {sentiment_label} (score: {sentiment_score})
- Price: {price_summary}

Style: Bloomberg Intelligence — crisp, specific, no invented numbers.

Output JSON:
{{
  "summary": "<3 sentences: company, current situation, our view — use only facts from KEY FINDINGS>",
  "investment_thesis": "<2 sentences: specific bull case from the strengths above>",
  "risks": ["<risk 1 from findings>", "<risk 2>", "<risk 3>"],
  "catalysts": ["<realistic near-term catalyst>", "<second>", "<third>"],
  "recommendation": "<BUY or HOLD or SELL>",
  "target_price": null,
  "confidence": <0.0-1.0: lower if key data was missing>
}}

Rules: JSON only. BUY/HOLD/SELL exactly. Do not invent numbers not in KEY FINDINGS.
"""
