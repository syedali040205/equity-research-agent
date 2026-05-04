"use client";


import { API } from "@/lib/api";
import { useEffect, useState } from "react";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface PeerData {
  ticker: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
  change_from_52w_low_pct: number | null;
  pe_ratio: number | null;
  market_cap: number | null;
  error?: string;
}

interface Props {
  ticker: string;
}

function fmtCap(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v}`;
}

function fmtPct(v: number | null, plus = true): string {
  if (v == null) return "—";
  return `${plus && v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default function PeerComparison({ ticker }: Props) {
  const [data, setData] = useState<PeerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/tools/peers/${ticker}`)
      .then(r => r.json())
      .then(d => { setData(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <Panel className="fade-up-1">
      <SectionLabel color="var(--cyan)">PEER COMPARISON</SectionLabel>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", padding: "12px 0" }}>
        LOADING PEERS…
      </div>
    </Panel>
  );

  const valid = data.filter(d => !d.error && d.price != null);
  if (!valid.length) return null;

  // Find min/max change_pct for bar scaling
  const pcts = valid.map(d => d.change_pct ?? 0);
  const maxAbs = Math.max(...pcts.map(Math.abs), 1);

  // Sort: current ticker first, then by market cap desc
  const sorted = [...valid].sort((a, b) => {
    if (a.ticker === ticker) return -1;
    if (b.ticker === ticker) return 1;
    return (b.market_cap ?? 0) - (a.market_cap ?? 0);
  });

  return (
    <Panel className="fade-up-1">
      <SectionLabel color="var(--cyan)">PEER COMPARISON</SectionLabel>

      <div style={{ overflowX: "auto" }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "80px 1fr 80px 90px 80px 70px",
          gap: 0, padding: "4px 0 8px",
          borderBottom: "1px solid var(--border)",
        }}>
          {["TICKER", "1D CHANGE", "PRICE", "MKT CAP", "P/E", "52W POS"].map(h => (
            <div key={h} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
              {h}
            </div>
          ))}
        </div>

        {sorted.map(d => {
          const isMain = d.ticker === ticker;
          const isPos = (d.change_pct ?? 0) >= 0;
          const barW = Math.abs(d.change_pct ?? 0) / maxAbs * 100;
          // 52w position: 0% = at 52w low, 100% = at 52w high
          const pos52 = (d.week_52_low != null && d.week_52_high != null && d.price != null)
            ? Math.max(0, Math.min(100, (d.price - d.week_52_low) / (d.week_52_high - d.week_52_low) * 100))
            : null;

          return (
            <div
              key={d.ticker}
              style={{
                display: "grid", gridTemplateColumns: "80px 1fr 80px 90px 80px 70px",
                gap: 0, padding: "9px 0",
                borderBottom: "1px solid var(--border)",
                background: isMain ? "rgba(240,165,0,0.03)" : "transparent",
              }}
            >
              {/* Ticker */}
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                color: isMain ? "var(--amber)" : "var(--text-secondary)",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {d.ticker}
                {isMain && (
                  <span style={{ fontSize: 8, color: "var(--amber)", opacity: 0.6, letterSpacing: "0.05em" }}>◀</span>
                )}
              </div>

              {/* Bar chart for 1D change */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: "var(--bg-hover)", position: "relative" }}>
                  <div style={{
                    position: "absolute",
                    left: isPos ? "50%" : `calc(50% - ${barW / 2}%)`,
                    width: `${barW / 2}%`,
                    height: "100%",
                    background: isPos ? "var(--green)" : "var(--red)",
                    opacity: 0.8,
                  }} />
                  <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "var(--border-bright)" }} />
                </div>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                  color: isPos ? "var(--green)" : "var(--red)", minWidth: 52, textAlign: "right",
                }}>
                  {fmtPct(d.change_pct)}
                </span>
              </div>

              {/* Price */}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-mono)" }}>
                {d.price != null ? `$${d.price.toFixed(2)}` : "—"}
              </div>

              {/* Market cap */}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
                {fmtCap(d.market_cap)}
              </div>

              {/* P/E */}
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 11,
                color: d.pe_ratio != null ? "var(--text-mono)" : "var(--text-dim)",
              }}>
                {d.pe_ratio != null ? d.pe_ratio.toFixed(1) : "—"}
              </div>

              {/* 52w position indicator */}
              <div style={{ display: "flex", alignItems: "center" }}>
                {pos52 != null ? (
                  <div style={{ flex: 1, height: 4, background: "var(--bg-hover)", position: "relative", borderRadius: 2 }}>
                    <div style={{
                      position: "absolute", left: 0, width: `${pos52}%`,
                      height: "100%", background: "var(--amber)", opacity: 0.5, borderRadius: 2,
                    }} />
                    <div style={{
                      position: "absolute", left: `calc(${pos52}% - 3px)`,
                      top: -2, width: 6, height: 8,
                      background: isMain ? "var(--amber)" : "var(--text-secondary)",
                      borderRadius: 1,
                    }} />
                  </div>
                ) : (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 8, letterSpacing: "0.08em" }}>
        52W POS: position between 52-week low (left) and high (right)
      </div>
    </Panel>
  );
}
