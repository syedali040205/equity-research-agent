"use client";

import { useState, useEffect, useRef } from "react";
import TopNav from "@/components/TopNav";
import TickerTape from "@/components/TickerTape";
import LoadingPage from "@/components/LoadingPage";
import MarketDataPanel from "@/components/MarketDataPanel";
import ExecutiveBrief from "@/components/ExecutiveBrief";
import AnalystAssessment from "@/components/AnalystAssessment";
import CriticReview from "@/components/CriticReview";
import AgentTrace from "@/components/AgentTrace";
import SourcesPanel from "@/components/SourcesPanel";
import NewsSidebar from "@/components/NewsSidebar";
import PriceChart from "@/components/PriceChart";
import SentimentBadge from "@/components/SentimentBadge";
import HistoryDrawer from "@/components/HistoryDrawer";
import ConfidenceBadge from "@/components/ConfidenceBadge";
import { ResearchResult } from "@/lib/types";

type Screen = "hero" | "loading" | "results" | "error";

const SUGGESTED = ["AAPL", "MSFT", "NVDA", "GOOGL", "TSLA", "META"];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("hero");
  const [ticker, setTicker] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [focused, setFocused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ResearchResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [marketData, setMarketData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (screen === "hero") setTimeout(() => inputRef.current?.focus(), 300);
  }, [screen]);

  useEffect(() => {
    if (screen === "loading") {
      setElapsed(0);
      intervalRef.current = setInterval(() => setElapsed((e) => e + 200), 200);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [screen]);

  async function runResearch(sym: string) {
    const t = sym.trim().toUpperCase();
    if (!t) return;
    setTicker(t);
    setScreen("loading");
    setElapsed(0);
    setResult(null);
    setMarketData(null);

    const API = "http://localhost:8000";

    try {
      const [resResp, priceResp] = await Promise.allSettled([
        fetch(`${API}/api/research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: t }),
          signal: AbortSignal.timeout(360_000),
        }),
        fetch(`${API}/api/tools/price/${t}`),
      ]);

      if (resResp.status === "fulfilled" && resResp.value.ok) {
        const data: ResearchResult = await resResp.value.json();
        setResult(data);
      } else {
        const errText = resResp.status === "fulfilled"
          ? await resResp.value.text()
          : (resResp.reason as Error)?.message ?? "Unknown error";
        setErrorMsg(errText);
        setScreen("error");
        return;
      }

      if (priceResp.status === "fulfilled" && priceResp.value.ok) {
        const p = await priceResp.value.json();
        const fmtCap = (v: number | null | undefined): string | undefined => {
          if (v == null) return undefined;
          if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
          if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
          if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
          return `$${v}`;
        };
        const fmtVol = (v: number | null | undefined): string | undefined => {
          if (v == null) return undefined;
          if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
          if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
          if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
          return String(v);
        };
        setMarketData({
          ticker: p.ticker,
          price: p.current_price,
          change_pct: p.change_pct_1d ?? 0,
          open: p.open,
          high: p.day_high,
          low: p.day_low,
          week52_high: p.week_52_high,
          week52_low: p.week_52_low,
          market_cap: fmtCap(p.market_cap),
          volume: fmtVol(p.volume),
          pe_ratio: p.pe_ratio,
          eps: p.eps,
          dividend_yield: p.dividend_yield != null
            ? `${(p.dividend_yield < 1 ? p.dividend_yield * 100 : p.dividend_yield).toFixed(2)}%`
            : undefined,
        });
      }

      setScreen("results");
    } catch (e) {
      setErrorMsg(String(e));
      setScreen("error");
    }
  }

  function reset() {
    setScreen("hero");
    setInputVal("");
    setResult(null);
  }

  const companyName =
    result?.company
      ? typeof result.company === "string"
        ? result.company
        : (result.company as { name?: string }).name ?? ticker
      : ticker;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopNav onReset={screen !== "hero" ? reset : undefined} onHistory={() => setHistoryOpen(true)} />
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={(t) => { setHistoryOpen(false); runResearch(t); }}
      />
      <TickerTape />

      {/* ── HERO ── */}
      {screen === "hero" && (
        <div
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", position: "relative", overflow: "hidden", padding: "40px 24px",
          }}
        >
          {/* Grid lines */}
          <div
            style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
              backgroundSize: "60px 60px", opacity: 0.4,
            }}
          />
          {/* Corner accents */}
          {(
            [
              { top: 40, left: 40, borderTop: "2px solid var(--amber)", borderLeft: "2px solid var(--amber)" },
              { top: 40, right: 40, borderTop: "2px solid var(--amber)", borderRight: "2px solid var(--amber)" },
              { bottom: 40, left: 40, borderBottom: "2px solid var(--amber)", borderLeft: "2px solid var(--amber)" },
              { bottom: 40, right: 40, borderBottom: "2px solid var(--amber)", borderRight: "2px solid var(--amber)" },
            ] as React.CSSProperties[]
          ).map((s, i) => (
            <div key={i} style={{ position: "absolute", width: 40, height: 40, opacity: 0.5, ...s }} />
          ))}
          {/* Central glow */}
          <div
            style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: 600, height: 300, borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(240,165,0,0.04) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", textAlign: "center", maxWidth: 680 }}>
            <div
              className="fade-up"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 32,
                padding: "5px 14px", border: "1px solid var(--amber-dim)", background: "var(--amber-glow)",
              }}
            >
              <div style={{ width: 6, height: 6, background: "var(--amber)" }} className="animate-blink" />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em", color: "var(--amber)" }}>
                MULTI-AGENT AI SYSTEM · FASTAPI BACKEND
              </span>
            </div>

            <h1
              className="fade-up-1"
              style={{
                fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 700,
                lineHeight: 1.05, marginBottom: 16, letterSpacing: "-0.02em", color: "var(--text-primary)",
              }}
            >
              Equity Research<br />
              <span style={{ color: "var(--amber)" }}>Intelligence</span>
            </h1>

            <p
              className="fade-up-2"
              style={{
                fontFamily: "var(--font-sans)", fontSize: 16, color: "var(--text-secondary)",
                lineHeight: 1.6, marginBottom: 48, fontWeight: 300,
              }}
            >
              AI-powered fundamental analysis. Deep brief, market data,<br />
              critic review, and full agent trace — in under 60 seconds.
            </p>

            {/* Search form */}
            <form
              onSubmit={(e) => { e.preventDefault(); runResearch(inputVal); }}
              className="fade-up-3"
            >
              <div
                style={{
                  display: "flex",
                  border: `1px solid ${focused ? "var(--amber)" : "var(--border-bright)"}`,
                  transition: "border-color 0.2s",
                  boxShadow: focused ? "0 0 0 3px rgba(240,165,0,0.08)" : "none",
                }}
              >
                <div
                  style={{
                    padding: "0 16px", display: "flex", alignItems: "center",
                    background: "var(--bg-panel)", borderRight: "1px solid var(--border)",
                    fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--amber)", fontWeight: 600,
                  }}
                >
                  $
                </div>
                <input
                  ref={inputRef}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value.toUpperCase())}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="ENTER TICKER SYMBOL"
                  maxLength={6}
                  style={{
                    flex: 1, background: "var(--bg-panel)", border: "none", outline: "none",
                    fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600,
                    color: "var(--text-primary)", padding: "18px 20px", letterSpacing: "0.12em",
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputVal.trim()}
                  style={{
                    padding: "0 32px",
                    background: inputVal.trim() ? "var(--amber)" : "var(--bg-hover)",
                    border: "none",
                    cursor: inputVal.trim() ? "pointer" : "not-allowed",
                    fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                    color: inputVal.trim() ? "var(--bg-primary)" : "var(--text-dim)",
                    letterSpacing: "0.1em", transition: "all 0.2s", flexShrink: 0,
                  }}
                >
                  ANALYZE →
                </button>
              </div>
            </form>

            {/* Suggestions */}
            <div className="fade-up-4" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", alignSelf: "center" }}>TRY:</span>
              {SUGGESTED.map((t) => (
                <button
                  key={t}
                  onClick={() => runResearch(t)}
                  style={{
                    background: "transparent", border: "1px solid var(--border)",
                    color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: 11,
                    padding: "5px 12px", cursor: "pointer", letterSpacing: "0.1em", transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.color = "var(--amber)"; e.currentTarget.style.background = "var(--amber-glow)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Feature pills */}
            <div className="fade-up-5" style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 48, flexWrap: "wrap" }}>
              {[
                ["⬡", "Executive Brief", "summary + thesis + risks"],
                ["◈", "Market Data", "live prices + technicals"],
                ["◷", "Agent Trace", "full pipeline timeline"],
                ["◈", "Critic Review", "AI self-critique"],
              ].map(([icon, label, sub], i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "12px 20px", border: "1px solid var(--border)",
                    background: "var(--bg-panel)", minWidth: 140,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--amber)" }}>{icon}</span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {screen === "loading" && <LoadingPage ticker={ticker} elapsed={elapsed} />}

      {/* ── ERROR ── */}
      {screen === "error" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)", letterSpacing: "0.12em", marginBottom: 12 }}>
              ✗ RESEARCH FAILED
            </div>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>{errorMsg}</p>
            <button
              onClick={reset}
              style={{
                padding: "10px 28px", background: "var(--amber)", border: "none",
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                color: "var(--bg-primary)", cursor: "pointer", letterSpacing: "0.1em",
              }}
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {screen === "results" && result && (
        <div>
          {/* Results header */}
          <div
            className="fade-up"
            style={{
              background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
              padding: "16px 24px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--amber)", letterSpacing: "-0.01em" }}>
                  {result.ticker}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--text-secondary)", fontWeight: 300 }}>
                  {companyName}
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 3, letterSpacing: "0.08em" }}>
                RES ID: {result.research_id} · {result.sources_cited} SOURCES · {(result.duration_ms / 1000).toFixed(1)}s
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <ConfidenceBadge value={result.confidence} large />
          </div>

          {/* Main grid */}
          <div
            style={{
              display: "grid", gridTemplateColumns: "1fr 300px",
              gap: 16, padding: 24, maxWidth: 1500, margin: "0 auto",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PriceChart ticker={result.ticker} />
              {marketData && <MarketDataPanel data={marketData} />}
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
              {result.trace?.length > 0 && (
                <AgentTrace trace={result.trace} totalMs={result.duration_ms} />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <NewsSidebar />
              <SourcesPanel sourcesCited={result.sources_cited} ticker={result.ticker} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
