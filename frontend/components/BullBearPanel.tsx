import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface Props {
  analysis: any;
  bearAnalysis: any;
}

export default function BullBearPanel({ analysis, bearAnalysis }: Props) {
  const hasContent = analysis?.thesis_one_liner || bearAnalysis?.bear_thesis;
  if (!hasContent) return null;

  const bullStrengths: string[] = analysis?.strengths?.slice(0, 3) ?? [];
  const bearRisks: string[] = bearAnalysis?.key_risks?.slice(0, 3) ?? [];
  const bearConf = bearAnalysis?.bear_confidence;

  return (
    <Panel className="fade-up-3">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <SectionLabel color="var(--amber)">BULL vs BEAR</SectionLabel>
        {bearConf != null && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
            BEAR CONVICTION: <span style={{ color: bearConf > 0.6 ? "var(--red)" : "var(--text-secondary)" }}>
              {Math.round(bearConf * 100)}%
            </span>
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Bull */}
        <div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
            color: "var(--green)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 12 }}>▲</span> BULL CASE
          </div>
          {analysis?.thesis_one_liner && (
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)",
              lineHeight: 1.6, fontWeight: 300, margin: "0 0 10px",
              paddingLeft: 10, borderLeft: "2px solid var(--green)",
            }}>
              {analysis.thesis_one_liner}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bullStrengths.map((s: string, i: number) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", flexShrink: 0, marginTop: 1 }}>+</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bear */}
        <div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
            color: "var(--red)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 12 }}>▼</span> BEAR CASE
          </div>
          {bearAnalysis?.bear_thesis && (
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-secondary)",
              lineHeight: 1.6, fontWeight: 300, margin: "0 0 10px",
              paddingLeft: 10, borderLeft: "2px solid var(--red)",
            }}>
              {bearAnalysis.bear_thesis}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bearRisks.map((r: string, i: number) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--red)", flexShrink: 0, marginTop: 1 }}>−</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {bearAnalysis?.bull_counterarguments_rebutted && (
        <div style={{
          marginTop: 14, padding: "10px 14px",
          background: "rgba(255,69,96,0.04)", border: "1px solid var(--red-dim)",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--red)", letterSpacing: "0.1em", marginBottom: 5 }}>
            BEAR REBUTTAL
          </div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6, fontWeight: 300 }}>
            {bearAnalysis.bull_counterarguments_rebutted}
          </p>
        </div>
      )}
    </Panel>
  );
}
