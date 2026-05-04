import ConfidenceBadge from "./ConfidenceBadge";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";
import { Critique } from "@/lib/types";

function sevColor(s: string) {
  return s === "high" || s === "critical" ? "var(--red)" : s === "medium" ? "var(--yellow)" : "var(--text-dim)";
}
function sevBg(s: string) {
  return s === "high" || s === "critical" ? "var(--red-glow)" : s === "medium" ? "rgba(245,197,24,0.08)" : "transparent";
}

export default function CriticReview({ critique }: { critique: Critique & { error?: string } }) {
  if (critique?.error) {
    return (
      <Panel className="fade-up-4">
        <SectionLabel color="var(--red)">CRITIC REVIEW</SectionLabel>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--red)" }}>
          LLM unavailable: {critique.error}
        </p>
      </Panel>
    );
  }
  return (
    <Panel className="fade-up-4">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <SectionLabel color="var(--red)">CRITIC REVIEW</SectionLabel>
        <ConfidenceBadge value={critique.confidence} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {critique.issues?.map((issue, i) => (
          <div
            key={i}
            style={{
              padding: "10px 14px",
              background: sevBg(issue.severity),
              border: `1px solid ${sevColor(issue.severity)}`,
              borderLeft: `3px solid ${sevColor(issue.severity)}`,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fontWeight: 700,
                color: sevColor(issue.severity),
                letterSpacing: "0.12em",
                flexShrink: 0,
                paddingTop: 2,
              }}
            >
              {issue.severity.toUpperCase()}
            </div>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              {issue.description}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "10px 14px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--green)",
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: "var(--green)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em" }}>
          FINAL VERDICT{" "}
        </strong>
        {critique.recommendation}
      </div>
    </Panel>
  );
}
