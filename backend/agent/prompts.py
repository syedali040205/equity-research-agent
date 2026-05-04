"""LLM prompts. Use placeholders in examples so model fills real data."""

SENTIMENT_PROMPT = """You are a financial news sentiment analyst. Score the NEWS below.

NEWS HEADLINES (most recent first):
{headlines}

Respond with this JSON only:
{{
  "score": <float from -1.0 (very bearish) to 1.0 (very bullish)>,
  "label": "<must be exactly: BULLISH or BEARISH or NEUTRAL>",
  "drivers": ["main positive or negative theme in 6 words", "second driver", "third driver"],
  "summary": "one sentence describing the overall news tone for {ticker}"
}}

Rules: output valid JSON only, no markdown. label must be BULLISH, BEARISH, or NEUTRAL exactly.
"""

ANALYST_PROMPT = """You are a senior equity research analyst. Analyze the DATA and output JSON.

DATA:
{raw_data}

CRITIC FEEDBACK TO ADDRESS (empty = first pass):
{critic_feedback}

Respond with this JSON structure. Replace every placeholder with real values from DATA above:
{{
  "thesis_one_liner": "one sentence investment view based on the actual data",
  "strengths": ["strength backed by a number from DATA", "another strength from DATA", "third strength from DATA"],
  "risks": ["risk from DATA", "another risk from DATA", "third risk from DATA"],
  "key_metrics": {{
    "revenue_growth_pct": <use derived_metrics.revenue_yoy_growth_pct from DATA or null>,
    "net_margin_pct": <use derived_metrics.net_margin_pct from DATA or null>,
    "pe_ratio": <use price.pe_ratio from DATA or null>,
    "debt_to_equity": <use derived_metrics.debt_to_equity from DATA or null>
  }},
  "market_assessment": "2-3 sentences on current_price, pe_ratio, week_52_high, week_52_low from DATA",
  "fundamental_assessment": "2-3 sentences on revenue, net_income, margins from DATA",
  "qualitative_assessment": "2-3 sentences on sector, industry, competitive position from DATA",
  "overall_assessment": "2-3 sentences synthesizing everything into a clear investment view",
  "data_gaps": ["list fields that were null or missing in DATA"]
}}

Rules: output valid JSON only, no markdown, no explanation. Use ONLY numbers from DATA — do not invent values.
"""

CRITIC_PROMPT = """You are a fact-checker for equity research. Verify the ANALYSIS against the DATA.

DATA:
{raw_data}

ANALYSIS TO CHECK:
{analysis}

Respond with this JSON. Replace placeholders with real evaluation of the ANALYSIS above:
{{
  "passed": true,
  "confidence": <integer 0-100 reflecting your confidence in the analysis>,
  "issues": [
    {{"description": "describe a specific claim in ANALYSIS that is wrong or unverifiable against DATA", "severity": "high"}},
    {{"description": "describe another issue", "severity": "medium"}}
  ],
  "recommendation": "one sentence overall verdict on the analysis quality",
  "verified_count": <count of claims you could verify as correct from DATA>
}}

Rules: output valid JSON only, no markdown. severity must be one of: critical, high, medium, low.
If no issues found, set issues to empty array [].
"""

WRITER_PROMPT = """You are a financial writer. Write a research brief for {company_name} ({ticker}).

ANALYSIS:
{analysis}

DATA:
{raw_data}

Respond with this JSON. Write using the ANALYSIS and DATA above — do not invent numbers:
{{
  "summary": "3 sentences describing the complete investment picture for {ticker} based on the analysis",
  "investment_thesis": "2-3 sentences explaining the bull case for {ticker} using strengths from ANALYSIS",
  "risks": ["first risk from ANALYSIS risks list", "second risk", "third risk"],
  "catalysts": ["near-term catalyst for {ticker}", "second catalyst", "third catalyst"],
  "recommendation": "<must be exactly BUY or HOLD or SELL based on overall_assessment>",
  "target_price": <derive from current_price in DATA adjusted for thesis, or null>,
  "confidence": <decimal 0.0-1.0 based on data completeness and conviction>
}}

Rules: output valid JSON only, no markdown. recommendation must be BUY, HOLD, or SELL exactly.
"""
