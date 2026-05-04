"use client";

import { useEffect, useState, useCallback } from "react";
import { API } from "@/lib/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface Holding {
  ticker: string;
  shares: number;
  costBasis: number; // price per share paid
}

interface HoldingWithPrice extends Holding {
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  pnlPct: number | null;
}

const STORAGE_KEY = "ea_portfolio";
const PIE_COLORS = ["#f0a500", "#00d084", "#00b4d8", "#ff4560", "#c77dff", "#48cae4", "#f5c518", "#80ed99"];

function loadHoldings(): Holding[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHoldings(h: Holding[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

function fmt(n: number | null, prefix = "$"): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${abs.toFixed(2)}`;
}

export default function PortfolioTracker() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [enriched, setEnriched] = useState<HoldingWithPrice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tickerInput, setTickerInput] = useState("");
  const [sharesInput, setSharesInput] = useState("");
  const [costInput, setCostInput] = useState("");
  const [addError, setAddError] = useState("");
  const [fetchingPrices, setFetchingPrices] = useState(false);

  useEffect(() => {
    setHoldings(loadHoldings());
  }, []);

  const fetchPrices = useCallback(async (h: Holding[]) => {
    if (h.length === 0) { setEnriched([]); return; }
    setFetchingPrices(true);
    try {
      const symbols = h.map(x => x.ticker).join(",");
      const r = await fetch(`${API}/api/tools/prices?symbols=${symbols}`, { signal: AbortSignal.timeout(15000) });
      const data = await r.json();
      const priceMap: Record<string, number | null> = {};
      for (const p of (data.prices ?? [])) priceMap[p.ticker] = p.price ?? null;
      setEnriched(h.map(holding => {
        const cp = priceMap[holding.ticker] ?? null;
        const mv = cp != null ? cp * holding.shares : null;
        const cost = holding.costBasis * holding.shares;
        const pnl = mv != null ? mv - cost : null;
        const pct = pnl != null && cost > 0 ? (pnl / cost) * 100 : null;
        return { ...holding, currentPrice: cp, marketValue: mv, unrealizedPnL: pnl, pnlPct: pct };
      }));
    } catch {
      setEnriched(h.map(x => ({ ...x, currentPrice: null, marketValue: null, unrealizedPnL: null, pnlPct: null })));
    } finally {
      setFetchingPrices(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices(holdings);
    const id = setInterval(() => fetchPrices(holdings), 60_000);
    return () => clearInterval(id);
  }, [holdings, fetchPrices]);

  function addHolding() {
    setAddError("");
    const t = tickerInput.trim().toUpperCase();
    const s = parseFloat(sharesInput);
    const c = parseFloat(costInput);
    if (!t || !/^[A-Z]{1,5}([.-][A-Z]{1,3})?$/.test(t)) { setAddError("Invalid ticker"); return; }
    if (isNaN(s) || s <= 0) { setAddError("Shares must be > 0"); return; }
    if (isNaN(c) || c <= 0) { setAddError("Cost basis must be > 0"); return; }
    if (holdings.some(h => h.ticker === t)) { setAddError("Already in portfolio"); return; }
    const updated = [...holdings, { ticker: t, shares: s, costBasis: c }];
    setHoldings(updated);
    saveHoldings(updated);
    setTickerInput(""); setSharesInput(""); setCostInput("");
    setShowForm(false);
  }

  function removeHolding(ticker: string) {
    const updated = holdings.filter(h => h.ticker !== ticker);
    setHoldings(updated);
    saveHoldings(updated);
  }

  const totalValue = enriched.reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const totalCost = enriched.reduce((s, h) => s + h.costBasis * h.shares, 0);
  const totalPnL = totalValue - totalCost;
  const totalPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const pieData = enriched
    .filter(h => h.marketValue != null && h.marketValue > 0)
    .map((h, i) => ({ name: h.ticker, value: h.marketValue!, color: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <Panel className="fade-up-3">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SectionLabel color="var(--amber)">PORTFOLIO</SectionLabel>
          {fetchingPrices && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>UPDATING…</span>
          )}
        </div>
        <button onClick={() => setShowForm(f => !f)} style={{
          fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 10px",
          background: showForm ? "var(--amber-glow)" : "transparent",
          border: `1px solid ${showForm ? "var(--amber)" : "var(--border)"}`,
          color: showForm ? "var(--amber)" : "var(--text-dim)",
          cursor: "pointer", letterSpacing: "0.08em",
        }}>
          {showForm ? "CANCEL" : "+ ADD"}
        </button>
      </div>

      {/* Add holding form */}
      {showForm && (
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", padding: 12, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[
              { label: "TICKER", value: tickerInput, setter: setTickerInput, placeholder: "AAPL" },
              { label: "SHARES", value: sharesInput, setter: setSharesInput, placeholder: "10" },
              { label: "COST/SHARE", value: costInput, setter: setCostInput, placeholder: "150.00" },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginBottom: 4, letterSpacing: "0.1em" }}>{label}</div>
                <input
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  onKeyDown={e => e.key === "Enter" && addHolding()}
                  style={{
                    width: "100%", background: "var(--bg-panel)", border: "1px solid var(--border)",
                    color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 11,
                    padding: "5px 8px", outline: "none",
                  }}
                />
              </div>
            ))}
          </div>
          {addError && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--red)", marginBottom: 8 }}>{addError}</div>}
          <button onClick={addHolding} style={{
            fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 16px",
            background: "var(--amber-glow)", border: "1px solid var(--amber)",
            color: "var(--amber)", cursor: "pointer", letterSpacing: "0.08em",
          }}>
            ADD HOLDING
          </button>
        </div>
      )}

      {holdings.length === 0 ? (
        <div style={{ padding: "24px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          No holdings. Click + ADD to track a position.
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            {[
              { label: "TOTAL VALUE", value: fmt(totalValue), color: "var(--text-primary)" },
              { label: "TOTAL P&L", value: `${totalPnL >= 0 ? "+" : ""}${fmt(totalPnL)}`, color: totalPnL >= 0 ? "var(--green)" : "var(--red)" },
              { label: "RETURN", value: `${totalPct >= 0 ? "+" : ""}${totalPct.toFixed(2)}%`, color: totalPct >= 0 ? "var(--green)" : "var(--red)" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>{label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color, marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
            {/* Holdings table */}
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 24px", gap: 4, marginBottom: 6 }}>
                {["TICKER", "PRICE", "VALUE", "P&L", "RETURN", ""].map(h => (
                  <div key={h} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>{h}</div>
                ))}
              </div>
              {enriched.map(h => {
                const pnlColor = (h.unrealizedPnL ?? 0) >= 0 ? "var(--green)" : "var(--red)";
                return (
                  <div key={h.ticker} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr 24px", gap: 4, padding: "5px 0", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--amber)", fontWeight: 600 }}>{h.ticker}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)" }}>
                      {h.currentPrice != null ? `$${h.currentPrice.toFixed(2)}` : "—"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{fmt(h.marketValue)}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: pnlColor }}>
                      {h.unrealizedPnL != null ? `${h.unrealizedPnL >= 0 ? "+" : ""}${fmt(h.unrealizedPnL)}` : "—"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: pnlColor }}>
                      {h.pnlPct != null ? `${h.pnlPct >= 0 ? "+" : ""}${h.pnlPct.toFixed(1)}%` : "—"}
                    </span>
                    <button onClick={() => removeHolding(h.ticker)} title="Remove" style={{
                      background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer",
                      fontFamily: "var(--font-mono)", fontSize: 11, padding: 0, lineHeight: 1,
                    }}>×</button>
                  </div>
                );
              })}
            </div>

            {/* Allocation pie */}
            {pieData.length > 0 && (
              <div style={{ width: 110 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 4 }}>ALLOCATION</div>
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={48} strokeWidth={0}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} opacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 10 }}
                      formatter={(v: any) => [`${((v / totalValue) * 100).toFixed(1)}%`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                  {pieData.map((entry, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: entry.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-secondary)" }}>
                        {entry.name} {((entry.value / totalValue) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
