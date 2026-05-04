"use client";


import { API } from "@/lib/api";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface YearData {
  year: string;
  revenue: number | null;
  net_income: number | null;
  gross_profit: number | null;
  eps: number | null;
}

function fmtVal(v: number | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

const TIP_STYLE = {
  background: "var(--bg-panel)", border: "1px solid var(--border)",
  fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)",
};

export default function FinancialSparklines({ ticker }: { ticker: string }) {
  const [data, setData] = useState<YearData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/tools/financials-history/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d.years || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ticker]);

  if (loading) return null;

  const hasRevenue = data.some(d => d.revenue != null);
  const hasNetIncome = data.some(d => d.net_income != null);
  if (!hasRevenue && !hasNetIncome) return null;

  const tickStyle = { fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-dim)" };

  return (
    <Panel className="fade-up-2">
      <SectionLabel color="var(--cyan)">FINANCIAL HISTORY</SectionLabel>

      {hasRevenue && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 6 }}>
            ANNUAL REVENUE
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
              <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={TIP_STYLE}
                formatter={(v: any) => [fmtVal(v), "Revenue"]}
                labelStyle={{ color: "var(--text-dim)" }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="revenue" radius={[2, 2, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i}
                    fill={i === data.length - 1 ? "var(--amber)" : "var(--cyan)"}
                    opacity={0.65 + (i / data.length) * 0.35}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasNetIncome && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 6 }}>
            NET INCOME
          </div>
          <ResponsiveContainer width="100%" height={70}>
            <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="20%">
              <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis hide />
              <ReferenceLine y={0} stroke="var(--border-bright)" strokeWidth={1} />
              <Tooltip
                contentStyle={TIP_STYLE}
                formatter={(v: any) => [fmtVal(v), "Net Income"]}
                labelStyle={{ color: "var(--text-dim)" }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="net_income" radius={[2, 2, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i}
                    fill={(d.net_income ?? 0) >= 0 ? "var(--green)" : "var(--red)"}
                    opacity={0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
