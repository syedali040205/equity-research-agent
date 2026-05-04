"use client";

import { API } from "@/lib/api";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, LineChart, Line, ComposedChart, Bar, Cell,
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
  ma50?: number | null;
  ma200?: number | null;
  rsi?: number | null;
  // candlestick helpers
  bodyLow?: number;
  bodyHigh?: number;
  wickRange?: [number, number];
  isUp?: boolean;
}

const RANGES = ["1mo", "3mo", "6mo", "1y", "2y"] as const;
type Range = (typeof RANGES)[number];
type ChartMode = "area" | "candle";

function fmtDate(ms: number, range: Range): string {
  const d = new Date(ms);
  if (range === "1mo") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (range === "3mo" || range === "6mo") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function sma(bars: Bar[], period: number): (number | null)[] {
  return bars.map((_, i) => {
    if (i < period - 1) return null;
    const sum = bars.slice(i - period + 1, i + 1).reduce((s, b) => s + b.close, 0);
    return Math.round((sum / period) * 100) / 100;
  });
}

function rsiCalc(bars: Bar[], period = 14): (number | null)[] {
  if (bars.length < period + 1) return bars.map(() => null);
  const out: (number | null)[] = Array(period).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = bars[i].close - bars[i - 1].close;
    if (ch > 0) avgGain += ch; else avgLoss -= ch;
  }
  avgGain /= period; avgLoss /= period;
  out.push(avgLoss === 0 ? 100 : Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 10) / 10);
  for (let i = period + 1; i < bars.length; i++) {
    const ch = bars[i].close - bars[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(0, ch)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -ch)) / period;
    out.push(avgLoss === 0 ? 100 : Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 10) / 10);
  }
  return out;
}

// Custom candlestick shape rendered inside a ComposedChart Bar
const CandleShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload || payload.open == null || payload.high == null || payload.low == null) return null;

  const { open, high, low, close, isUp } = payload;
  const color = isUp ? "var(--green)" : "var(--red)";

  // We need chart's y-scale. recharts passes yAxis props indirectly via y/height.
  // Use the bar's y/height to infer pixel positions for the full OHLC range.
  // bodyLow and bodyHigh are set as the bar's dataKey range (stackId trick).
  // We draw the wick manually using SVG.
  const cx = x + width / 2;

  // The bar already represents body (min(open,close) to max(open,close))
  // y = top of bar, y+height = bottom of bar in SVG coords
  const bodyTop = y;
  const bodyBottom = y + height;

  // For wick we need pixel positions of high/low relative to chart.
  // recharts doesn't expose yScale directly, so we calculate proportionally
  // using the wickRange we encoded: [low, high] as a separate bar with opacity 0.
  // Instead: use yAxis domain. Since we can't get it here, encode wick pixels
  // into the payload via pre-computed fields set in data prep.
  const wickTopPx = payload._wickTopPx;
  const wickBotPx = payload._wickBotPx;

  return (
    <g>
      {/* Wick */}
      {wickTopPx != null && wickBotPx != null && (
        <line x1={cx} x2={cx} y1={wickTopPx} y2={wickBotPx} stroke={color} strokeWidth={1} />
      )}
      {/* Body */}
      <rect
        x={x + 1}
        y={bodyTop}
        width={Math.max(width - 2, 1)}
        height={Math.max(height, 1)}
        fill={isUp ? "var(--green)" : "var(--red)"}
        opacity={0.85}
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Bar;
  return (
    <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border-bright)", padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 11 }}>
      <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>
        {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </div>
      <div>C: <span style={{ color: "var(--amber)" }}>${d.close.toFixed(2)}</span></div>
      {d.open != null && <div style={{ color: "var(--text-secondary)" }}>O: ${d.open.toFixed(2)}</div>}
      {d.high != null && <div style={{ color: "var(--green)" }}>H: ${d.high.toFixed(2)}</div>}
      {d.low != null && <div style={{ color: "var(--red)" }}>L: ${d.low.toFixed(2)}</div>}
      {d.ma50 && <div style={{ color: "rgba(240,165,0,0.7)" }}>MA50: ${d.ma50.toFixed(2)}</div>}
      {d.ma200 && <div style={{ color: "rgba(0,180,216,0.7)" }}>MA200: ${d.ma200.toFixed(2)}</div>}
      {d.volume && <div style={{ color: "var(--text-dim)", marginTop: 2 }}>Vol: {(d.volume / 1e6).toFixed(1)}M</div>}
    </div>
  );
};

const RsiTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", padding: "4px 8px", fontFamily: "var(--font-mono)", fontSize: 10 }}>
      RSI: <span style={{ color: val > 70 ? "var(--red)" : val < 30 ? "var(--green)" : "var(--cyan)" }}>{val?.toFixed(1)}</span>
    </div>
  );
};

export default function PriceChart({ ticker }: { ticker: string }) {
  const [range, setRange] = useState<Range>("3mo");
  const [mode, setMode] = useState<ChartMode>("area");
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true); setError("");
    fetch(`${API}/api/tools/history/${ticker}?range=${range}`, { signal: AbortSignal.timeout(12000) })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setBars([]); return; }
        const raw: Bar[] = d.bars || [];
        const ma50vals = sma(raw, 50);
        const ma200vals = sma(raw, 200);
        const rsiVals = rsiCalc(raw);
        setBars(raw.map((b, i) => ({
          ...b,
          ma50: ma50vals[i],
          ma200: ma200vals[i],
          rsi: rsiVals[i],
          isUp: (b.close ?? 0) >= (b.open ?? b.close),
          bodyLow: Math.min(b.open ?? b.close, b.close),
          bodyHigh: Math.max(b.open ?? b.close, b.close),
        })));
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [ticker, range]);

  const prices = bars.map(b => b.close);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const first = bars[0]?.close ?? 0;
  const last = bars[bars.length - 1]?.close ?? 0;
  const isUp = last >= first;
  const pct = first ? (((last - first) / first) * 100).toFixed(2) : "0.00";
  const color = isUp ? "var(--green)" : "var(--red)";
  const labelStep = Math.max(1, Math.floor(bars.length / 6));

  const has50 = bars.some(b => b.ma50 != null);
  const has200 = bars.some(b => b.ma200 != null);
  const rsiData = bars.filter(b => b.rsi != null);
  const lastRsi = rsiData[rsiData.length - 1]?.rsi;
  const rsiColor = lastRsi != null ? (lastRsi > 70 ? "var(--red)" : lastRsi < 30 ? "var(--green)" : "var(--cyan)") : "var(--cyan)";

  // For candlestick: compute domain including wicks
  const allLows = bars.map(b => b.low ?? b.close);
  const allHighs = bars.map(b => b.high ?? b.close);
  const candleMin = Math.min(...allLows) * 0.99;
  const candleMax = Math.max(...allHighs) * 1.01;

  const xAxisProps = {
    dataKey: "date" as const,
    tickFormatter: (v: number, i: number) => i % labelStep === 0 ? fmtDate(v, range) : "",
    tick: { fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-dim)" },
    axisLine: { stroke: "var(--border)" } as any,
    tickLine: false as const,
  };

  const yAxisProps = {
    tick: { fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-dim)" },
    axisLine: false as const,
    tickLine: false as const,
    width: 50,
  };

  return (
    <Panel className="fade-up-1">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <SectionLabel color="var(--cyan)">PRICE CHART</SectionLabel>
          {!loading && bars.length > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, letterSpacing: "0.05em" }}>
              {isUp ? "▲" : "▼"} {isUp ? "+" : ""}{pct}%
            </span>
          )}
          {lastRsi != null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: rsiColor, letterSpacing: "0.05em" }}>
              RSI {lastRsi.toFixed(0)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {/* Chart mode toggle */}
          {(["area", "candle"] as ChartMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px",
              background: mode === m ? "rgba(0,180,216,0.12)" : "transparent",
              border: `1px solid ${mode === m ? "var(--cyan)" : "var(--border)"}`,
              color: mode === m ? "var(--cyan)" : "var(--text-dim)",
              cursor: "pointer", letterSpacing: "0.08em",
            }}>
              {m === "area" ? "LINE" : "OHLC"}
            </button>
          ))}
          <div style={{ width: 1, background: "var(--border)", margin: "0 2px" }} />
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px",
              background: range === r ? "var(--amber-glow)" : "transparent",
              border: `1px solid ${range === r ? "var(--amber)" : "var(--border)"}`,
              color: range === r ? "var(--amber)" : "var(--text-dim)",
              cursor: "pointer", letterSpacing: "0.08em",
            }}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          LOADING…
        </div>
      )}
      {error && (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)" }}>
          {error}
        </div>
      )}

      {!loading && !error && bars.length > 0 && (
        <>
          {mode === "area" ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={bars} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} domain={[minP * 0.98, maxP * 1.02]} tickFormatter={v => `$${v.toFixed(0)}`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={first} stroke="var(--border-bright)" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.5}
                  fill="url(#chartGrad)" dot={false}
                  activeDot={{ r: 3, fill: color, stroke: "var(--bg-panel)", strokeWidth: 2 }}
                />
                {has50 && (
                  <Line type="monotone" dataKey="ma50" stroke="rgba(240,165,0,0.6)"
                    strokeWidth={1} dot={false} connectNulls activeDot={false}
                  />
                )}
                {has200 && (
                  <Line type="monotone" dataKey="ma200" stroke="rgba(0,180,216,0.6)"
                    strokeWidth={1} dot={false} connectNulls activeDot={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            // Candlestick chart using ComposedChart
            // We draw wicks as a thin bar spanning low→high (transparent fill, colored stroke)
            // and the body as a bar spanning min(open,close)→max(open,close)
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={bars} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} domain={[candleMin, candleMax]} tickFormatter={v => `$${v.toFixed(0)}`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={first} stroke="var(--border-bright)" strokeDasharray="3 3" />
                {/* Wick: thin bar from low to high */}
                <Bar dataKey="high" stackId="candle" fill="transparent" isAnimationActive={false} barSize={1}>
                  {bars.map((b, i) => (
                    <Cell key={i} fill={b.isUp ? "var(--green)" : "var(--red)"} opacity={0.9} />
                  ))}
                </Bar>
                {/* Body: bar from bodyLow to bodyHigh using error-bar trick */}
                {/* recharts doesn't support floating bars natively, so we use a workaround:
                    render two stacked bars — invisible base + visible body */}
                <Bar dataKey="bodyLow" stackId="body" fill="transparent" isAnimationActive={false} />
                <Bar dataKey={(d: Bar) => (d.bodyHigh ?? d.close) - (d.bodyLow ?? d.close)} stackId="body" isAnimationActive={false} minPointSize={1}>
                  {bars.map((b, i) => (
                    <Cell key={i} fill={b.isUp ? "var(--green)" : "var(--red)"} opacity={0.85} />
                  ))}
                </Bar>
                {has50 && (
                  <Line type="monotone" dataKey="ma50" stroke="rgba(240,165,0,0.6)"
                    strokeWidth={1} dot={false} connectNulls activeDot={false}
                  />
                )}
                {has200 && (
                  <Line type="monotone" dataKey="ma200" stroke="rgba(0,180,216,0.6)"
                    strokeWidth={1} dot={false} connectNulls activeDot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginTop: 4, marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(240,165,0,0.6)" }}>— 50D MA</span>
            {has200 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,180,216,0.6)" }}>— 200D MA</span>}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>— RSI(14) below</span>
          </div>

          {/* RSI panel */}
          {rsiData.length > 5 && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 4 }}>
                RSI (14)
              </div>
              <ResponsiveContainer width="100%" height={70}>
                <LineChart data={bars} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis domain={[0, 100]} ticks={[30, 50, 70]}
                    tick={{ fontFamily: "var(--font-mono)", fontSize: 8, fill: "var(--text-dim)" }}
                    axisLine={false} tickLine={false} width={28}
                  />
                  <ReferenceLine y={70} stroke="rgba(255,69,96,0.4)" strokeDasharray="3 2" strokeWidth={1} />
                  <ReferenceLine y={30} stroke="rgba(0,208,132,0.4)" strokeDasharray="3 2" strokeWidth={1} />
                  <ReferenceLine y={50} stroke="var(--border)" strokeWidth={1} />
                  <Tooltip content={<RsiTooltip />} />
                  <Line type="monotone" dataKey="rsi" stroke={rsiColor}
                    strokeWidth={1.2} dot={false} connectNulls activeDot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
