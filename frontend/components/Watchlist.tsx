"use client";

import { useEffect, useState } from "react";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

const STORAGE_KEY = "ea_watchlist";

export function useWatchlist() {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setList(saved);
    } catch { setList([]); }
  }, []);

  function add(ticker: string) {
    const t = ticker.trim().toUpperCase();
    if (!t || list.includes(t)) return;
    const next = [...list, t];
    setList(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function remove(ticker: string) {
    const next = list.filter(t => t !== ticker);
    setList(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return { list, add, remove };
}

interface WatchlistPanelProps {
  currentTicker?: string;
  onResearch: (ticker: string) => void;
}

export default function WatchlistPanel({ currentTicker, onResearch }: WatchlistPanelProps) {
  const { list, add, remove } = useWatchlist();
  const [prices, setPrices] = useState<Record<string, { price: number; pct: number }>>({});

  useEffect(() => {
    if (!list.length) return;
    list.forEach(ticker => {
      fetch(`http://localhost:8000/api/tools/price/${ticker}`)
        .then(r => r.json())
        .then(d => {
          if (d.current_price != null) {
            setPrices(prev => ({ ...prev, [ticker]: { price: d.current_price, pct: d.change_pct_1d ?? 0 } }));
          }
        })
        .catch(() => {});
    });
  }, [list.join(",")]);

  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SectionLabel color="var(--amber)">WATCHLIST</SectionLabel>
        {currentTicker && !list.includes(currentTicker) && (
          <button
            onClick={() => add(currentTicker)}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 9, padding: "3px 8px",
              background: "var(--amber-glow)", border: "1px solid var(--amber-dim)",
              color: "var(--amber)", cursor: "pointer", letterSpacing: "0.08em",
            }}
          >
            + ADD {currentTicker}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", textAlign: "center", padding: "16px 0" }}>
          No tickers yet — add the current one above
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {list.map(t => {
            const p = prices[t];
            const isPos = (p?.pct ?? 0) >= 0;
            return (
              <div
                key={t}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 0", borderBottom: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={() => onResearch(t)}
                  style={{
                    flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "transparent", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--amber)" }}>{t}</span>
                  {p ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: isPos ? "var(--green)" : "var(--red)" }}>
                      ${p.price.toFixed(2)} <span style={{ fontSize: 10 }}>{isPos ? "+" : ""}{p.pct.toFixed(2)}%</span>
                    </span>
                  ) : (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>—</span>
                  )}
                </button>
                <button
                  onClick={() => remove(t)}
                  style={{
                    background: "transparent", border: "none", color: "var(--text-dim)",
                    cursor: "pointer", fontSize: 12, padding: "0 4px", lineHeight: 1,
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
