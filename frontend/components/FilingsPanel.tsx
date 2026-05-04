"use client";


import { API } from "@/lib/api";
import { useEffect, useState } from "react";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface Filing {
  filing_type: string;
  filed_at: string;
  period_of_report: string | null;
  items: string | null;
  primary_doc_url: string | null;
  filing_index_url: string | null;
  accession_number: string;
}

interface Props {
  ticker: string;
}

const TYPE_COLORS: Record<string, string> = {
  "10-K": "var(--amber)",
  "10-Q": "var(--cyan)",
  "8-K": "var(--green)",
  "DEF 14A": "var(--text-dim)",
  "S-1": "var(--red)",
  "SC 13G": "var(--text-dim)",
  "SC 13D": "var(--text-dim)",
  "4": "var(--text-dim)",
};

function describeItems(items: string | null, formType: string): string {
  if (items) return items.slice(0, 80);
  const descriptions: Record<string, string> = {
    "10-K": "Annual report — full year financials, MD&A, risk factors",
    "10-Q": "Quarterly report — financials and business update",
    "8-K": "Current report — material event disclosure",
    "DEF 14A": "Proxy statement — shareholder meeting agenda",
    "S-1": "Registration statement — IPO or securities offering",
  };
  return descriptions[formType] || "SEC filing";
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m}mo ago`;
  return `${Math.floor(m / 12)}y ago`;
}

export default function FilingsPanel({ ticker }: Props) {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/tools/filings/${ticker}?limit=8`)
      .then(r => r.json())
      .then(d => {
        setFilings(d.filings || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker]);

  if (loading) return (
    <Panel>
      <SectionLabel color="var(--amber)">SEC FILINGS</SectionLabel>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", padding: "12px 0" }}>
        LOADING…
      </div>
    </Panel>
  );

  if (!filings.length) return (
    <Panel>
      <SectionLabel color="var(--amber)">SEC FILINGS</SectionLabel>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", padding: "12px 0" }}>
        No filings found for {ticker}
      </div>
    </Panel>
  );

  return (
    <Panel>
      <SectionLabel color="var(--amber)">SEC FILINGS</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {filings.map((f, i) => {
          const isExp = expanded === i;
          const color = TYPE_COLORS[f.filing_type] || "var(--text-secondary)";
          const desc = describeItems(f.items, f.filing_type);
          const url = f.primary_doc_url || f.filing_index_url;
          return (
            <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <button
                onClick={() => setExpanded(isExp ? null : i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 0", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
                  color, border: `1px solid ${color}`, padding: "1px 5px",
                  letterSpacing: "0.06em", flexShrink: 0, opacity: 0.9,
                }}>
                  {f.filing_type}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)", flex: 1, textAlign: "left" }}>
                  {f.period_of_report
                    ? new Date(f.period_of_report).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                    : "—"
                  }
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                  {f.filed_at ? timeAgo(f.filed_at) : "—"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginLeft: 4 }}>
                  {isExp ? "▲" : "▼"}
                </span>
              </button>

              {isExp && (
                <div style={{
                  padding: "0 0 10px 0", marginBottom: 2,
                  fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-secondary)",
                  lineHeight: 1.6, fontWeight: 300,
                  borderLeft: `2px solid ${color}`, paddingLeft: 10,
                }}>
                  {desc}
                  {url && (
                    <div style={{ marginTop: 6 }}>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: "var(--font-mono)", fontSize: 9, color, textDecoration: "none", letterSpacing: "0.08em" }}>
                        VIEW ON SEC.GOV →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
