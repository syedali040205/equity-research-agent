"use client";

import { API } from "@/lib/api";
import { useEffect, useState } from "react";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "BRK-B", "XOM", "UNH"];

interface TickItem { t: string; p: string; c: string; up: boolean }

const placeholder: TickItem[] = SYMBOLS.map(s => ({
  t: s === "BRK-B" ? "BRK.B" : s,
  p: "—",
  c: "—",
  up: true,
}));

async function fetchAll(): Promise<TickItem[]> {
  try {
    const r = await fetch(
      `${API}/api/tools/prices?symbols=${SYMBOLS.join(",")}`,
      { signal: AbortSignal.timeout(20000) },
    );
    if (!r.ok) return placeholder;
    const d = await r.json();
    return (d.prices ?? []).map((p: any) => ({
      t: p.ticker === "BRK-B" ? "BRK.B" : p.ticker,
      p: p.price != null ? `$${p.price.toFixed(2)}` : "—",
      c: p.change_pct != null ? `${p.change_pct >= 0 ? "+" : ""}${p.change_pct.toFixed(2)}%` : "—",
      up: (p.change_pct ?? 0) >= 0,
    }));
  } catch {
    return placeholder;
  }
}

export default function TickerTape() {
  const [items, setItems] = useState<TickItem[]>(placeholder);

  useEffect(() => {
    fetchAll().then(setItems);
    const id = setInterval(() => fetchAll().then(setItems), 60_000);
    return () => clearInterval(id);
  }, []);

  const doubled = [...items, ...items];

  return (
    <div
      style={{
        height: 32,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        className="animate-ticker"
        style={{ display: "flex", whiteSpace: "nowrap", width: "max-content" }}
      >
        {doubled.map((item, i) => (
          <div
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "0 20px",
              borderRight: "1px solid var(--border)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{item.t}</span>
            <span style={{ color: "var(--text-primary)" }}>{item.p}</span>
            <span style={{ color: item.up ? "var(--green)" : "var(--red)" }}>{item.c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
