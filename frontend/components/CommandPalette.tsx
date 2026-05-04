"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onSearch: (ticker: string) => void;
  recentTickers: string[];
}

const SHORTCUTS = [
  ["R", "Re-run current research"],
  ["H", "Open history drawer"],
  ["W", "Add to watchlist"],
  ["C", "Copy share link"],
  ["/", "Open command palette"],
  ["Esc", "Close / go back"],
];

export default function CommandPalette({ onSearch, recentTickers }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(tag)) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 30);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit() {
    const t = input.trim().toUpperCase();
    if (!t) return;
    setOpen(false);
    setInput("");
    onSearch(t);
  }

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 540,
          background: "var(--bg-panel)", border: "1px solid var(--border-bright)",
          boxShadow: "0 32px 96px rgba(0,0,0,0.7)",
        }}
      >
        {/* Input row */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--amber)", padding: "0 16px", fontWeight: 700 }}>$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
            placeholder="TICKER SYMBOL…"
            maxLength={6}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700,
              color: "var(--text-primary)", padding: "16px 0", letterSpacing: "0.14em",
            }}
          />
          <button
            onClick={submit}
            disabled={!input.trim()}
            style={{
              margin: "8px 12px", padding: "6px 14px",
              background: input.trim() ? "var(--amber)" : "var(--bg-hover)",
              border: "none", cursor: input.trim() ? "pointer" : "not-allowed",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              color: input.trim() ? "#000" : "var(--text-dim)", letterSpacing: "0.08em",
            }}
          >
            ANALYZE
          </button>
        </div>

        {/* Recent tickers */}
        {recentTickers.length > 0 && (
          <div style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em", padding: "8px 16px 6px" }}>
              RECENT
            </div>
            {recentTickers.map(t => (
              <button
                key={t}
                onClick={() => { onSearch(t); setOpen(false); setInput(""); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "8px 16px", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--amber)", minWidth: 50 }}>{t}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.08em" }}>RESEARCH →</span>
              </button>
            ))}
          </div>
        )}

        {/* Keyboard shortcuts */}
        <div style={{ padding: "8px 0 12px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.12em", padding: "4px 16px 8px" }}>
            SHORTCUTS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 16px" }}>
                <kbd style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)",
                  border: "1px solid var(--amber-dim)", padding: "1px 7px",
                  minWidth: 28, textAlign: "center", background: "var(--amber-glow)",
                }}>
                  {key}
                </kbd>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
