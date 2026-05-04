"use client";

import { API } from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TopNav from "@/components/TopNav";
import TickerTape from "@/components/TickerTape";
import MarketDataPanel from "@/components/MarketDataPanel";
import ExecutiveBrief from "@/components/ExecutiveBrief";
import AnalystAssessment from "@/components/AnalystAssessment";
import CriticReview from "@/components/CriticReview";
import AgentTrace from "@/components/AgentTrace";
import PriceChart from "@/components/PriceChart";
import SentimentBadge from "@/components/SentimentBadge";
import ChatPanel from "@/components/ChatPanel";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import PeerComparison from "@/components/PeerComparison";
import FilingsPanel from "@/components/FilingsPanel";
import { ResearchResult } from "@/lib/types";

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");
  const [marketData, setMarketData] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/api/research/${id}`)
      .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(data => {
        setResult(data);
        return fetch(`${API}/api/tools/price/${data.ticker}`);
      })
      .then(r => r.json())
      .then(p => {
        if (!p.error) {
          const fmtVol = (v: number | null) => v == null ? undefined : v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : String(v);
          setMarketData({
            ticker: p.ticker, price: p.current_price, change_pct: p.change_pct_1d ?? 0,
            open: p.open, high: p.day_high, low: p.day_low,
            week52_high: p.week_52_high, week52_low: p.week_52_low,
            volume: fmtVol(p.volume), pe_ratio: p.pe_ratio,
          });
        }
      })
      .catch(e => setError(String(e)));
  }, [id]);

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopNav />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", color: "var(--red)", fontSize: 14 }}>
          Research not found: {id}
        </div>
      </div>
    </div>
  );

  if (!result) return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopNav />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
          LOADING…
        </div>
      </div>
    </div>
  );

  const companyName = typeof result.company === "string"
    ? result.company
    : (result.company as any)?.name ?? result.ticker;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopNav />
      <TickerTape />

      {/* Header */}
      <div style={{
        background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        padding: "16px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--amber)" }}>
              {result.ticker}
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--text-secondary)", fontWeight: 300 }}>
              {companyName}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 3 }}>
            {(result as any).generated_at
              ? `GENERATED ${new Date((result as any).generated_at).toLocaleString()}`
              : `RES ID: ${result.research_id}`}
            {" · "}{result.sources_cited} SOURCES · {((result.duration_ms || 0) / 1000).toFixed(1)}s
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
            SHARED RESEARCH
          </span>
          <ConfidenceBadge value={result.confidence} large />
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, padding: 24, maxWidth: 1500, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <PriceChart ticker={result.ticker} />
          {marketData && <MarketDataPanel data={marketData} />}
          <PeerComparison ticker={result.ticker} />
          {result.sentiment?.label && (
            <div style={{ padding: "10px 16px", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <SentimentBadge sentiment={result.sentiment} />
              {result.sentiment.summary && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)", margin: "8px 0 0", lineHeight: 1.5, fontWeight: 300 }}>
                  {result.sentiment.summary}
                </p>
              )}
            </div>
          )}
          <ExecutiveBrief brief={result.brief} />
          <AnalystAssessment analysis={result.analysis} />
          <CriticReview critique={result.critique} />
          {result.trace?.length > 0 && <AgentTrace trace={result.trace} totalMs={result.duration_ms} />}
          <ChatPanel researchId={result.research_id} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FilingsPanel ticker={result.ticker} />
          <div style={{ padding: "12px 16px", background: "var(--bg-secondary)", border: "1px solid var(--amber-dim)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber)", letterSpacing: "0.12em", marginBottom: 4 }}>
              SHARE LINK
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", wordBreak: "break-all" }}>
              {typeof window !== "undefined" ? window.location.href : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
