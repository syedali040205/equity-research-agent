"use client";


import { API } from "@/lib/api";
import { useEffect, useState } from "react";

interface BriefRow {
  research_id: string;
  ticker: string;
  generated_at: string;
  model: string;
  duration_ms: number;
  confidence: number | null;
  sources_cited: number;
  recommendation: string | null;
  summary: string;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const recColor = (r: string | null) =>
  r === "BUY" ? "var(--green)" : r === "SELL" ? "var(--red)" : "var(--text-dim)";

export default function HistoryDrawer({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (ticker: string) => void;
}) {
  const [rows, setRows] = useState<BriefRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${API}/api/research/history?limit=30`)
      .then((r) => r.json())
      .then((d) => setRows(d.briefs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          zIndex: 100, backdropFilter: "blur(2px)",
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
          background: "var(--bg-panel)",
          borderLeft: "1px solid var(--border-bright)",
          zIndex: 101, display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", letterSpacing: "0.14em" }}>
              RESEARCH HISTORY
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
              {rows.length} runs stored
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 16,
              width: 32, height: 32, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: 24, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
              LOADING…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div style={{ padding: 24, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
              No research history yet
            </div>
          )}
          {rows.map((row) => (
            <button
              key={row.research_id}
              onClick={() => { onSelect(row.ticker); onClose(); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "14px 20px",
                background: "transparent", border: "none",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
                      color: "var(--amber)",
                    }}
                  >
                    {row.ticker}
                  </span>
                  {row.recommendation && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
                        color: recColor(row.recommendation),
                        border: `1px solid ${recColor(row.recommendation)}`,
                        padding: "1px 6px", letterSpacing: "0.1em",
                      }}
                    >
                      {row.recommendation}
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                  {timeAgo(row.generated_at)}
                </span>
              </div>
              {row.summary && (
                <div
                  style={{
                    fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-secondary)",
                    lineHeight: 1.45, fontWeight: 300,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}
                >
                  {row.summary}
                </div>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                {row.confidence != null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                    CONF {Math.round(row.confidence * 100)}%
                  </span>
                )}
                {row.duration_ms && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                    {(row.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                  {row.sources_cited} SRC
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
