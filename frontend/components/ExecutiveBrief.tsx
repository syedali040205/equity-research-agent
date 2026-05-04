import ConfidenceBadge from "./ConfidenceBadge";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";
import { Brief } from "@/lib/types";

export default function ExecutiveBrief({ brief }: { brief: Brief & { error?: string } }) {
  if (brief?.error) {
    return (
      <Panel className="fade-up-2">
        <SectionLabel>EXECUTIVE BRIEF</SectionLabel>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--red)" }}>
          LLM unavailable: {brief.error}
        </p>
      </Panel>
    );
  }
  const recColor =
    brief.recommendation === "BUY"
      ? "var(--green)"
      : brief.recommendation === "SELL"
      ? "var(--red)"
      : "var(--yellow)";
  const recGlow =
    brief.recommendation === "BUY"
      ? "var(--green-glow)"
      : brief.recommendation === "SELL"
      ? "var(--red-glow)"
      : "rgba(245,197,24,0.1)";

  return (
    <Panel className="fade-up-2">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <SectionLabel>EXECUTIVE BRIEF</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <ConfidenceBadge value={brief.confidence} />
          <div
            style={{
              padding: "6px 16px",
              background: recGlow,
              border: `2px solid ${recColor}`,
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 700,
              color: recColor,
              letterSpacing: "0.1em",
            }}
          >
            {brief.recommendation}
          </div>
          {brief.target_price != null && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--amber)" }}>
              ${brief.target_price}
            </div>
          )}
        </div>
      </div>

      <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 20, fontWeight: 300 }}>
        {brief.summary}
      </p>

      <div
        style={{
          padding: "14px 16px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--amber)",
          marginBottom: 20,
        }}
      >
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber)", letterSpacing: "0.14em", marginBottom: 8 }}>
          INVESTMENT THESIS
        </div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
          {brief.investment_thesis}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--red)", letterSpacing: "0.14em", marginBottom: 10 }}>
            ▼ KEY RISKS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {brief.risks?.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 4, height: 4, background: "var(--red)", flexShrink: 0, marginTop: 6 }} />
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--green)", letterSpacing: "0.14em", marginBottom: 10 }}>
            ▲ CATALYSTS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {brief.catalysts?.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 4, height: 4, background: "var(--green)", flexShrink: 0, marginTop: 6 }} />
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
