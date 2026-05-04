import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface Props {
  sourcesCited: number;
  ticker: string;
}

export default function SourcesPanel({ sourcesCited, ticker }: Props) {
  const sources = [
    { type: "FILING", label: `${ticker} — 10-K (Annual Report)`, url: "SEC EDGAR" },
    { type: "FILING", label: `${ticker} — 10-Q (Latest Quarter)`, url: "SEC EDGAR" },
    { type: "PRICE", label: `${ticker} Live Quote & OHLCV`, url: "Market Data API" },
    { type: "NEWS", label: "Recent news articles (30d)", url: "Yahoo Finance RSS" },
    { type: "ANALYSIS", label: "Fundamental metrics & ratios", url: "yfinance" },
  ];

  const typeColor = (t: string) =>
    t === "FILING" ? "var(--amber)" : t === "PRICE" ? "var(--cyan)" : t === "NEWS" ? "var(--text-secondary)" : "var(--green)";

  return (
    <Panel className="fade-up-6">
      <SectionLabel color="var(--text-dim)">SOURCES · {sourcesCited} CITED</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {sources.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex", gap: 10, alignItems: "center",
              padding: "7px 0", borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700,
                color: typeColor(s.type), letterSpacing: "0.1em", width: 52, flexShrink: 0,
              }}
            >
              {s.type}
            </div>
            <div style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)" }}>
              {s.label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
              {s.url}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
