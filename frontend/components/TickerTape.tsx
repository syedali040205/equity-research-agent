"use client";

import { useEffect, useState } from "react";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "BRK-B", "XOM", "UNH"];

const FALLBACK: Record<string, { p: string; c: string; up: boolean }> = {
  AAPL:  { p: "—",  c: "—",     up: true  },
  MSFT:  { p: "—",  c: "—",     up: true  },
  NVDA:  { p: "—",  c: "—",     up: true  },
  GOOGL: { p: "—",  c: "—",     up: false },
  AMZN:  { p: "—",  c: "—",     up: true  },
  META:  { p: "—",  c: "—",     up: true  },
  TSLA:  { p: "—",  c: "—",     up: false },
  JPM:   { p: "—",  c: "—",     up: true  },
  V:     { p: "—",  c: "—",     up: true  },
  "BRK-B": { p: "—", c: "—",   up: true  },
  XOM:   { p: "—",  c: "—",     up: false },
  UNH:   { p: "—",  c: "—",     up: true  },
};

interface TickItem { t: string; p: string; c: string; up: boolean }

async function fetchPrice(ticker: string): Promise<TickItem | null> {
  try {
    const r = await fetch(`http://localhost:8000/api/tools/price/${ticker}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.error || d.current_price == null) return null;
    const pct = d.change_pct_1d ?? 0;
    return {
      t: ticker === "BRK-B" ? "BRK.B" : ticker,
      p: `$${d.current_price.toFixed(2)}`,
      c: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
      up: pct >= 0,
    };
  } catch {
    return null;
  }
}

export default function TickerTape() {
  const [items, setItems] = useState<TickItem[]>(
    SYMBOLS.map((s) => ({ t: s === "BRK-B" ? "BRK.B" : s, ...FALLBACK[s] }))
  );

  async function refresh() {
    const results = await Promise.allSettled(SYMBOLS.map(fetchPrice));
    setItems((prev) =>
      prev.map((item, i) => {
        const r = results[i];
        return r.status === "fulfilled" && r.value ? r.value : item;
      })
    );
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
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
