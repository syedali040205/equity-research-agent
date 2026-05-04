"use client";

const PIPELINE = [
  { node: "introspect",              label: "INTROSPECT",       desc: "Validate ticker" },
  { node: "research_market",         label: "MARKET DATA",      desc: "Live price snapshot" },
  { node: "research_fundamentals",   label: "FUNDAMENTALS",     desc: "Financial statements" },
  { node: "research_qualitative",    label: "QUALITATIVE",      desc: "News + SEC filings" },
  { node: "analyst",                 label: "ANALYST LLM",      desc: "Synthesize analysis" },
  { node: "news_sentiment",          label: "SENTIMENT LLM",    desc: "Score news tone" },
  { node: "critic",                  label: "CRITIC LLM",       desc: "Fact-check analysis" },
  { node: "writer",                  label: "WRITER LLM",       desc: "Draft final brief" },
];

interface Props {
  ticker: string;
  elapsed: number;
  streamNodes?: Record<string, any>;
  activeNode?: string | null;
}

export default function LoadingPage({ ticker, elapsed, streamNodes = {}, activeNode }: Props) {
  const completedNodes = new Set(Object.keys(streamNodes));
  const completedCount = completedNodes.size;
  const progress = activeNode
    ? Math.min((completedCount + 0.5) / PIPELINE.length, 0.97)
    : Math.min(completedCount / PIPELINE.length, 0.97);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ width: "100%", maxWidth: 700 }}>
        {/* Header */}
        <div style={{ marginBottom: 36, textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16,
              padding: "8px 20px", border: "1px solid var(--amber)", background: "var(--amber-glow)",
            }}
          >
            <div
              style={{
                width: 12, height: 12,
                border: "2px solid var(--amber)", borderTopColor: "transparent",
                borderRadius: "50%", flexShrink: 0,
              }}
              className="animate-spin-slow"
            />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.12em", color: "var(--amber)", fontWeight: 600 }}>
              ANALYZING {ticker}
            </span>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
            {activeNode
              ? `Running ${activeNode.toUpperCase().replace(/_/g, " ")} · ${(elapsed / 1000).toFixed(1)}s`
              : `Pipeline initializing · ${(elapsed / 1000).toFixed(1)}s elapsed`}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ height: 2, background: "var(--border)", position: "relative", overflow: "hidden" }}>
            <div
              style={{
                position: "absolute", top: 0, left: 0, height: "100%",
                width: `${progress * 100}%`, background: "var(--amber)",
                transition: "width 0.5s ease", boxShadow: "0 0 8px var(--amber)",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
              PIPELINE PROGRESS
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber)" }}>
              {completedCount}/{PIPELINE.length} NODES
            </span>
          </div>
        </div>

        {/* Node grid — 2 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--border)" }}>
          {PIPELINE.map((step) => {
            const isDone = completedNodes.has(step.node);
            const isActive = activeNode === step.node;
            const nodeEvent = streamNodes[step.node];
            const durationMs = nodeEvent?.trace_entry?.duration_ms;

            return (
              <div
                key={step.node}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  background: isDone ? "rgba(0,200,100,0.04)" : isActive ? "var(--amber-glow)" : "var(--bg-panel)",
                  transition: "background 0.3s",
                }}
              >
                {/* Status dot */}
                <div
                  style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: isDone ? "var(--green)" : isActive ? "var(--amber)" : "var(--border-bright)",
                    boxShadow: isActive ? "0 0 6px var(--amber)" : isDone ? "0 0 4px var(--green)" : "none",
                  }}
                  className={isActive ? "animate-pulse-amber" : ""}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.1em",
                        color: isDone ? "var(--green)" : isActive ? "var(--amber)" : "var(--text-dim)",
                      }}
                    >
                      {step.label}
                    </span>
                    {isDone && durationMs != null && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--green)", opacity: 0.7 }}>
                        {durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
                      </span>
                    )}
                    {isActive && (
                      <div style={{ display: "flex", gap: 2 }}>
                        {[0, 1, 2].map(j => (
                          <div key={j} style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--amber)" }} className="animate-blink" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>
                    {isDone
                      ? (nodeEvent?.trace_entry?.output_summary || step.desc)
                      : step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textAlign: "center", marginTop: 20, lineHeight: 1.7, letterSpacing: "0.05em" }}>
          PARALLEL RESEARCH · 3 LLM PASSES · LOCAL GPU INFERENCE
        </p>
      </div>
    </div>
  );
}
