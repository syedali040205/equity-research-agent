"use client";

import { useState } from "react";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";
import { Analysis } from "@/lib/types";

export default function AnalystAssessment({ analysis }: { analysis: Analysis & { error?: string } }) {
  if (analysis?.error) {
    return (
      <Panel className="fade-up-3">
        <SectionLabel color="var(--cyan)">ANALYST ASSESSMENT</SectionLabel>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--red)" }}>
          LLM unavailable: {analysis.error}
        </p>
      </Panel>
    );
  }
  const [active, setActive] = useState(0);

  const tabs = [
    { label: "MARKET", key: "market_assessment" as const, color: "var(--cyan)" },
    { label: "FUNDAMENTALS", key: "fundamental_assessment" as const, color: "var(--amber)" },
    { label: "QUALITATIVE", key: "qualitative_assessment" as const, color: "var(--green)" },
    { label: "OVERALL", key: "overall_assessment" as const, color: "var(--text-primary)" },
  ];

  return (
    <Panel className="fade-up-3">
      <SectionLabel color="var(--cyan)">ANALYST ASSESSMENT</SectionLabel>
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            style={{
              padding: "8px 14px",
              background: "transparent",
              border: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              color: active === i ? tab.color : "var(--text-dim)",
              letterSpacing: "0.1em",
              cursor: "pointer",
              borderBottom: active === i ? `2px solid ${tab.color}` : "2px solid transparent",
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75, fontWeight: 300 }}>
        {analysis[tabs[active].key]}
      </p>
    </Panel>
  );
}
