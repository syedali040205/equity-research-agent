"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface Props {
  ticker: string;
  currentPrice: number | null;
  eps: number | null;           // trailing EPS from EDGAR
  revenueGrowth?: number | null; // last year revenue growth % (optional hint)
}

const RISK_PRESETS = {
  low:    { label: "LOW RISK",    wacc: 8 },
  medium: { label: "MEDIUM RISK", wacc: 10 },
  high:   { label: "HIGH RISK",   wacc: 13 },
};

type Risk = keyof typeof RISK_PRESETS;

function runDCF(eps: number, growthPct: number, waccPct: number, terminalGrowthPct: number, years = 5) {
  const g = growthPct / 100;
  const wacc = waccPct / 100;
  const tg = terminalGrowthPct / 100;

  let fcf = eps; // treat EPS as a proxy for per-share FCF (simple model)
  let pvSum = 0;
  const yearRows: { year: string; fcf: number; pv: number }[] = [];

  for (let t = 1; t <= years; t++) {
    fcf *= (1 + g);
    const pv = fcf / Math.pow(1 + wacc, t);
    pvSum += pv;
    yearRows.push({ year: `Y${t}`, fcf: Math.round(fcf * 100) / 100, pv: Math.round(pv * 100) / 100 });
  }

  // Terminal value using Gordon Growth Model
  const terminalFCF = fcf * (1 + tg);
  const terminalValue = wacc > tg ? terminalFCF / (wacc - tg) : fcf * 20;
  const pvTerminal = terminalValue / Math.pow(1 + wacc, years);
  const intrinsic = pvSum + pvTerminal;

  return { intrinsic, pvSum, pvTerminal, yearRows };
}

export default function DCFCalculator({ ticker, currentPrice, eps }: Props) {
  const [growthPct, setGrowthPct] = useState(12);
  const [risk, setRisk] = useState<Risk>("medium");
  const [terminalGrowthPct, setTerminalGrowthPct] = useState(2.5);
  const [years] = useState(5);

  const wacc = RISK_PRESETS[risk].wacc;

  const result = useMemo(() => {
    if (!eps || eps <= 0) return null;
    return runDCF(eps, growthPct, wacc, terminalGrowthPct, years);
  }, [eps, growthPct, wacc, terminalGrowthPct, years]);

  const upside = result && currentPrice ? ((result.intrinsic - currentPrice) / currentPrice) * 100 : null;
  const isUnder = upside != null && upside > 0;
  const marginOfSafety = result && currentPrice ? ((result.intrinsic - currentPrice) / result.intrinsic) * 100 : null;

  const chartData = result ? [
    ...result.yearRows.map(r => ({ label: r.year, value: r.pv, type: "pv" as const })),
    { label: "TV", value: Math.round(result.pvTerminal * 100) / 100, type: "tv" as const },
  ] : [];

  return (
    <Panel className="fade-up-4">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SectionLabel color="var(--cyan)">DCF VALUATION</SectionLabel>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
          {ticker} · EPS-BASED MODEL
        </span>
      </div>

      {(!eps || eps <= 0) ? (
        <div style={{ padding: "20px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          EPS data unavailable — run research first
        </div>
      ) : (
        <>
          {/* Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            {/* Growth rate */}
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 6 }}>
                GROWTH RATE · {growthPct}%
              </div>
              <input
                type="range" min={1} max={40} step={1} value={growthPct}
                onChange={e => setGrowthPct(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--amber)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", marginTop: 2 }}>
                <span>1%</span><span>40%</span>
              </div>
            </div>

            {/* Terminal growth */}
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 6 }}>
                TERMINAL GROWTH · {terminalGrowthPct}%
              </div>
              <input
                type="range" min={0.5} max={5} step={0.5} value={terminalGrowthPct}
                onChange={e => setTerminalGrowthPct(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--cyan)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", marginTop: 2 }}>
                <span>0.5%</span><span>5%</span>
              </div>
            </div>

            {/* Risk / WACC */}
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 6 }}>
                DISCOUNT RATE · WACC {wacc}%
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {(Object.entries(RISK_PRESETS) as [Risk, typeof RISK_PRESETS[Risk]][]).map(([key, preset]) => (
                  <button key={key} onClick={() => setRisk(key)} style={{
                    flex: 1, fontFamily: "var(--font-mono)", fontSize: 9, padding: "4px 2px",
                    background: risk === key ? "rgba(0,180,216,0.12)" : "transparent",
                    border: `1px solid ${risk === key ? "var(--cyan)" : "var(--border)"}`,
                    color: risk === key ? "var(--cyan)" : "var(--text-dim)",
                    cursor: "pointer", letterSpacing: "0.05em",
                  }}>
                    {key.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {result && (
            <>
              {/* Result banner */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
                padding: "12px", marginBottom: 14,
                background: isUnder ? "var(--green-glow)" : "var(--red-glow)",
                border: `1px solid ${isUnder ? "var(--green-dim)" : "var(--red-dim)"}`,
              }}>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>INTRINSIC VALUE</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: isUnder ? "var(--green)" : "var(--red)", marginTop: 2 }}>
                    ${result.intrinsic.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>UPSIDE / DOWNSIDE</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: isUnder ? "var(--green)" : "var(--red)", marginTop: 2 }}>
                    {upside != null ? `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%` : "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                    {isUnder ? "MARGIN OF SAFETY" : "PREMIUM TO VALUE"}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: isUnder ? "var(--green)" : "var(--red)", marginTop: 2 }}>
                    {marginOfSafety != null ? `${Math.abs(marginOfSafety).toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>

              {/* Verdict badge */}
              <div style={{ marginBottom: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>
                {isUnder
                  ? `Stock appears ${upside! > 30 ? "significantly " : ""}undervalued at $${currentPrice != null ? currentPrice.toFixed(2) : "—"} vs intrinsic $${result.intrinsic.toFixed(2)}`
                  : `Stock appears ${Math.abs(upside!) > 30 ? "significantly " : ""}overvalued at $${currentPrice != null ? currentPrice.toFixed(2) : "—"} vs intrinsic $${result.intrinsic.toFixed(2)}`
                }
                {marginOfSafety != null && isUnder && marginOfSafety > 20 && (
                  <span style={{ color: "var(--green)", marginLeft: 6 }}>✓ {marginOfSafety.toFixed(0)}% margin of safety</span>
                )}
              </div>

              {/* PV breakdown bar chart */}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 6 }}>
                PRESENT VALUE BREAKDOWN (per share)
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }} barCategoryGap="15%">
                  <XAxis dataKey="label" tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-dim)" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 10 }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "PV"]}
                    labelStyle={{ color: "var(--text-dim)" }}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.type === "tv" ? "var(--amber)" : "var(--cyan)"} opacity={0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(0,180,216,0.7)" }}>■ FCF years 1-{years}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(240,165,0,0.7)" }}>■ Terminal value</span>
              </div>

              {/* Disclaimer */}
              <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", lineHeight: 1.5 }}>
                Note: simplified model using trailing EPS as FCF proxy. Not financial advice.
              </div>
            </>
          )}
        </>
      )}
    </Panel>
  );
}
