interface Sentiment {
  score: number;
  label: string;
  drivers: string[];
  summary: string;
}

export default function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  if (!sentiment?.label) return null;

  const isUp = sentiment.label === "BULLISH";
  const isDown = sentiment.label === "BEARISH";
  const color = isUp ? "var(--green)" : isDown ? "var(--red)" : "var(--text-dim)";
  const glow = isUp ? "var(--green-glow)" : isDown ? "var(--red-glow)" : "transparent";
  const bar = Math.abs(sentiment.score ?? 0);
  const barColor = isUp ? "var(--green)" : isDown ? "var(--red)" : "var(--border-bright)";
  const arrow = isUp ? "▲" : isDown ? "▼" : "●";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Gauge bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
          NEWS SENTIMENT
        </span>
        <div
          style={{
            padding: "3px 10px",
            background: glow,
            border: `1px solid ${color}`,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            color,
            letterSpacing: "0.1em",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {arrow} {sentiment.label}
        </div>
        <div
          style={{
            width: 60,
            height: 4,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: `${bar * 100}%`,
              background: barColor,
              ...(isDown ? { right: 0 } : { left: 0 }),
            }}
          />
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color, minWidth: 36 }}>
          {(sentiment.score ?? 0) >= 0 ? "+" : ""}{((sentiment.score ?? 0)).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
