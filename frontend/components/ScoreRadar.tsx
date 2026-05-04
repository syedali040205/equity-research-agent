"use client";

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface Props {
  analysis: any;
  sentiment: any;
  price: any;
  brief: any;
}

function clamp(v: number, min = 0, max = 10) {
  return Math.min(max, Math.max(min, v));
}

function computeScores(analysis: any, sentiment: any, price: any, brief: any) {
  // Technical: price position in 52w range
  const high = price?.week_52_high ?? price?.week52_high;
  const low = price?.week_52_low ?? price?.week52_low;
  const cur = price?.current_price ?? price?.price;
  const technical = (high != null && low != null && cur != null && high !== low)
    ? clamp(((cur - low) / (high - low)) * 10)
    : 5;

  // Fundamental: based on margin data
  const margin = analysis?.key_metrics?.net_margin_pct;
  const growth = analysis?.key_metrics?.revenue_growth_pct;
  let fundamental = 4; // penalize missing data
  if (margin != null) fundamental = clamp(2 + margin / 3);
  if (growth != null) fundamental = clamp(fundamental + growth / 20);

  // Sentiment: news score -1..1 → 0..10
  const score = sentiment?.score;
  const sentiScore = score != null ? clamp(((score + 1) / 2) * 10) : 5;

  // Qualitative: based on brief confidence and recommendation
  const conf = brief?.confidence ?? 0.5;
  const rec = brief?.recommendation;
  let qualitative = clamp(conf * 8);
  if (rec === "BUY") qualitative = clamp(qualitative + 1.5);
  if (rec === "SELL") qualitative = clamp(qualitative - 1.5);

  return [
    { axis: "TECHNICAL", score: Math.round(technical * 10) / 10 },
    { axis: "FUNDAMENTAL", score: Math.round(fundamental * 10) / 10 },
    { axis: "SENTIMENT", score: Math.round(sentiScore * 10) / 10 },
    { axis: "QUALITATIVE", score: Math.round(qualitative * 10) / 10 },
  ];
}

const CustomTick = ({ x, y, payload }: any) => (
  <text
    x={x} y={y}
    textAnchor="middle" dominantBaseline="middle"
    fontFamily="var(--font-mono)" fontSize={9}
    fill="var(--text-dim)" letterSpacing="0.08em"
  >
    {payload.value}
  </text>
);

export default function ScoreRadar({ analysis, sentiment, price, brief }: Props) {
  const scores = computeScores(analysis, sentiment, price, brief);
  const avg = Math.round(scores.reduce((s, d) => s + d.score, 0) / scores.length * 10) / 10;

  const rec = brief?.recommendation;
  const recColor = rec === "BUY" ? "var(--green)" : rec === "SELL" ? "var(--red)" : "var(--amber)";

  return (
    <Panel className="fade-up-2">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SectionLabel color="var(--cyan)">RESEARCH SCORECARD</SectionLabel>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: recColor }}>
            {avg}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>/10</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={scores} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="axis" tick={<CustomTick />} />
          <Radar
            dataKey="score"
            stroke="var(--amber)"
            fill="var(--amber)"
            fillOpacity={0.15}
            strokeWidth={1.5}
            dot={{ fill: "var(--amber)", r: 3, strokeWidth: 0 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-panel)", border: "1px solid var(--border)",
              fontFamily: "var(--font-mono)", fontSize: 10,
            }}
            formatter={(v: any) => [`${v}/10`]}
            labelStyle={{ color: "var(--text-dim)" }}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, marginTop: 4 }}>
        {scores.map(({ axis, score }) => {
          const color = score >= 7 ? "var(--green)" : score >= 4 ? "var(--amber)" : "var(--red)";
          return (
            <div key={axis} style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color }}>{score}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.08em", marginTop: 2 }}>
                {axis.slice(0, 4)}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
