"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface Bar {
  date: number;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

const RANGES = ["1mo", "3mo", "6mo", "1y", "2y"] as const;
type Range = (typeof RANGES)[number];

function fmt(ms: number, range: Range): string {
  const d = new Date(ms);
  if (range === "1mo") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (range === "3mo" || range === "6mo")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Bar;
  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border-bright)",
        padding: "8px 12px",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      }}
    >
      <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>
        {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </div>
      <div style={{ color: "var(--text-primary)" }}>
        C: <span style={{ color: "var(--amber)" }}>${d.close.toFixed(2)}</span>
      </div>
      {d.open && <div style={{ color: "var(--text-secondary)" }}>O: ${d.open.toFixed(2)}</div>}
      {d.high && <div style={{ color: "var(--green)" }}>H: ${d.high.toFixed(2)}</div>}
      {d.low && <div style={{ color: "var(--red)" }}>L: ${d.low.toFixed(2)}</div>}
      {d.volume && (
        <div style={{ color: "var(--text-dim)", marginTop: 2 }}>
          Vol: {(d.volume / 1e6).toFixed(1)}M
        </div>
      )}
    </div>
  );
};

export default function PriceChart({ ticker }: { ticker: string }) {
  const [range, setRange] = useState<Range>("6mo");
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`http://localhost:8000/api/tools/history/${ticker}?range=${range}`, {
      signal: AbortSignal.timeout(12000),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setBars([]); }
        else setBars(d.bars || []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [ticker, range]);

  const prices = bars.map((b) => b.close);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const first = bars[0]?.close ?? 0;
  const last = bars[bars.length - 1]?.close ?? 0;
  const isUp = last >= first;
  const pct = first ? (((last - first) / first) * 100).toFixed(2) : "0.00";
  const color = isUp ? "var(--green)" : "var(--red)";

  // Thin the x-axis labels so they don't overlap
  const labelStep = Math.max(1, Math.floor(bars.length / 6));

  return (
    <Panel className="fade-up-1">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <SectionLabel color="var(--cyan)">PRICE HISTORY</SectionLabel>
          {!loading && bars.length > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, letterSpacing: "0.05em" }}>
              {isUp ? "▲" : "▼"} {isUp ? "+" : ""}{pct}%
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                padding: "3px 8px",
                background: range === r ? "var(--amber-glow)" : "transparent",
                border: `1px solid ${range === r ? "var(--amber)" : "var(--border)"}`,
                color: range === r ? "var(--amber)" : "var(--text-dim)",
                cursor: "pointer",
                letterSpacing: "0.08em",
              }}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          LOADING CHART DATA…
        </div>
      )}
      {error && (
        <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)" }}>
          {error}
        </div>
      )}
      {!loading && !error && bars.length > 0 && (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={bars} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(v, i) => (i % labelStep === 0 ? fmt(v, range) : "")}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-dim)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              domain={[minP * 0.98, maxP * 1.02]}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-dim)" }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={first} stroke="var(--border-bright)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={1.5}
              fill="url(#chartGrad)"
              dot={false}
              activeDot={{ r: 3, fill: color, stroke: "var(--bg-panel)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
