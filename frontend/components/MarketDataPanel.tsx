import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface MarketData {
  ticker: string;
  price: number;
  change_pct: number;
  change_abs?: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: string | number;
  market_cap?: string;
  pe_ratio?: number;
  eps?: number;
  dividend_yield?: string | number;
  week52_high?: number;
  week52_low?: number;
}

interface Props {
  data: MarketData;
}

function fmt(v: string | number | undefined, prefix = ""): string {
  if (v === undefined || v === null) return "—";
  return `${prefix}${v}`;
}

export default function MarketDataPanel({ data }: Props) {
  const isPos = data.change_pct >= 0;
  return (
    <Panel className="fade-up-1">
      <SectionLabel color="var(--cyan)">MARKET DATA</SectionLabel>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 34,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          ${data.price?.toFixed(2) ?? "—"}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            background: isPos ? "var(--green-glow)" : "var(--red-glow)",
            border: `1px solid ${isPos ? "var(--green-dim)" : "var(--red-dim)"}`,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 600,
              color: isPos ? "var(--green)" : "var(--red)",
            }}
          >
            {isPos ? "+" : ""}{data.change_pct}%
            {data.change_abs !== undefined ? `  ${isPos ? "+" : ""}${data.change_abs}` : ""}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        {[
          ["OPEN", fmt(data.open, "$")],
          ["HIGH", fmt(data.high, "$")],
          ["LOW", fmt(data.low, "$")],
          ["VOLUME", fmt(data.volume)],
          ["MKT CAP", fmt(data.market_cap)],
          ["P/E RATIO", fmt(data.pe_ratio)],
          ["EPS (TTM)", fmt(data.eps, "$")],
          ["DIV YIELD", fmt(data.dividend_yield)],
          ["52W HIGH", fmt(data.week52_high, "$")],
          ["52W LOW", fmt(data.week52_low, "$")],
        ].map(([label, val], i) => (
          <div
            key={i}
            style={{
              padding: "9px 0",
              borderBottom: "1px solid var(--border)",
              borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none",
              paddingRight: i % 2 === 0 ? 12 : 0,
              paddingLeft: i % 2 === 1 ? 12 : 0,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--text-dim)",
                letterSpacing: "0.1em",
                marginBottom: 3,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-mono)",
              }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
