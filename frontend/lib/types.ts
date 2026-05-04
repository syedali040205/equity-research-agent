export interface Brief {
  summary: string;
  investment_thesis: string;
  risks: string[];
  catalysts: string[];
  recommendation: "BUY" | "HOLD" | "SELL";
  target_price: number;
  confidence: number;
}

export interface Analysis {
  market_assessment: string;
  fundamental_assessment: string;
  qualitative_assessment: string;
  overall_assessment: string;
}

export interface CritiqueIssue {
  severity: "high" | "medium" | "low" | "critical";
  description: string;
}

export interface Critique {
  issues: CritiqueIssue[];
  confidence: number;
  recommendation: string;
}

export interface TraceNode {
  node: string;
  input_summary: string;
  output_summary: string;
  duration_ms: number;
}

export interface Company {
  name?: string;
  sector?: string;
  exchange?: string;
}

export interface Sentiment {
  score: number;
  label: "BULLISH" | "BEARISH" | "NEUTRAL";
  drivers: string[];
  summary: string;
}

export interface ResearchResult {
  research_id: string;
  ticker: string;
  duration_ms: number;
  confidence: number;
  sources_cited: number;
  company: Company | string;
  brief: Brief;
  analysis: Analysis;
  sentiment?: Sentiment;
  critique: Critique;
  trace: TraceNode[];
  error_history: string[];
  retry_count?: number;
}
