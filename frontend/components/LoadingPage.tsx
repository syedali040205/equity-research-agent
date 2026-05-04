"use client";

const NODES = [
  { name: "ResearchOrchestrator", done: "Dispatched parallel tools" },
  { name: "PriceFetcher", done: "Live quote fetched" },
  { name: "NewsScraper", done: "Articles ingested" },
  { name: "FilingsParser", done: "SEC filings parsed" },
  { name: "AnalystLLM", done: "Brief + analysis generated" },
  { name: "CriticLLM", done: "Issues identified" },
  { name: "ResponseAssembler", done: "Final object assembled" },
];

interface Props {
  ticker: string;
  elapsed: number;
}

export default function LoadingPage({ ticker, elapsed }: Props) {
  const totalMs = 55000;
  const progress = Math.min(elapsed / totalMs, 0.97);
  const activeNodeIdx = Math.min(Math.floor(progress * NODES.length), NODES.length - 1);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ width: "100%", maxWidth: 680 }}>
        {/* Header */}
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 20,
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
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-secondary)" }}>
            Multi-agent pipeline running · {(elapsed / 1000).toFixed(1)}s elapsed
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ height: 2, background: "var(--border)", position: "relative", overflow: "hidden" }}>
            <div
              style={{
                position: "absolute", top: 0, left: 0, height: "100%",
                width: `${progress * 100}%`, background: "var(--amber)",
                transition: "width 0.3s ease", boxShadow: "0 0 8px var(--amber)",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>PIPELINE PROGRESS</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)" }}>{Math.round(progress * 100)}%</span>
          </div>
        </div>

        {/* Node timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {NODES.map((node, i) => {
            const isDone = i < activeNodeIdx;
            const isActive = i === activeNodeIdx;
            return (
              <div key={node.name} style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 3 }}>
                  <div
                    style={{
                      width: 10, height: 10, borderRadius: "50%",
                      border: `1px solid ${isDone ? "var(--green)" : isActive ? "var(--amber)" : "var(--border)"}`,
                      background: isDone ? "var(--green)" : isActive ? "var(--amber)" : "transparent",
                    }}
                    className={isActive ? "animate-pulse-amber" : ""}
                  />
                  {i < NODES.length - 1 && (
                    <div style={{ width: 1, height: 28, background: isDone ? "var(--green-dim)" : "var(--border)", marginTop: 4 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
                        color: isDone ? "var(--green)" : isActive ? "var(--amber)" : "var(--text-dim)",
                      }}
                    >
                      {node.name}
                    </span>
                    {isDone && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", opacity: 0.7 }}>DONE</span>}
                    {isActive && (
                      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                        {[0, 1, 2].map((j) => (
                          <div
                            key={j}
                            style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--amber)" }}
                            className="animate-blink"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {isDone && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                      {node.done}
                    </div>
                  )}
                  {isActive && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", opacity: 0.7, marginTop: 2 }}>
                      Processing...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
          Fetching live prices, news &amp; SEC filings, then running<br />
          3 LLM passes (analyst → critic → writer) on local CPU.<br />
          <span style={{ color: "var(--amber)" }}>Expect 2–4 minutes on CPU inference.</span>
        </p>
      </div>
    </div>
  );
}
