"use client";


import { API } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface Article {
  ticker: string;
  title: string;
  url: string;
  source: string;
  published_at: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NewsSidebar() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchNews() {
    try {
      const r = await fetch(`${API}/api/tools/news/live?limit=30&hours=48`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return;
      const d = await r.json();
      setArticles(d.articles ?? []);
      setLastUpdate(new Date());
    } catch {
      // silent — sidebar is non-critical
    }
  }

  useEffect(() => {
    fetchNews();
    intervalRef.current = setInterval(fetchNews, 5 * 60 * 1000); // 5 min
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <Panel style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
        <SectionLabel color="var(--cyan)">LIVE NEWS</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, background: "var(--green)", borderRadius: "50%", animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.1em" }}>
            {lastUpdate ? `UPDATED ${timeAgo(lastUpdate.toISOString())}` : "FETCHING…"}
          </span>
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
        {articles.length === 0 && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "center", paddingTop: 24 }}>
            No recent news
          </div>
        )}
        {articles.map((a, i) => (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--amber)",
                  letterSpacing: "0.12em",
                  background: "var(--amber-glow)",
                  padding: "1px 5px",
                  border: "1px solid var(--amber-dim)",
                }}
              >
                {a.ticker}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                {timeAgo(a.published_at)}
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.45,
                fontWeight: 300,
              }}
            >
              {a.title}
            </div>
          </a>
        ))}
      </div>
    </Panel>
  );
}
