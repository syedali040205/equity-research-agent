import Panel from "./Panel";
import SectionLabel from "./SectionLabel";
import { TraceNode } from "@/lib/types";

const NODE_COLORS = [
  "var(--amber)", "var(--cyan)", "var(--cyan)", "var(--cyan)",
  "var(--green)", "var(--red)", "var(--amber)",
];

export default function AgentTrace({ trace, totalMs }: { trace: TraceNode[]; totalMs: number }) {
  return (
    <Panel className="fade-up-5">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <SectionLabel color="var(--green)">AGENT TRACE</SectionLabel>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          TOTAL: {(totalMs / 1000).toFixed(2)}s
        </span>
      </div>

      {/* Gantt timeline */}
      <div style={{ marginBottom: 20 }}>
        {trace.map((node, i) => {
          const dur = node.duration_ms ?? 0;
          const barWidth = Math.max((dur / totalMs) * 100, 0.5);
          const offset = trace.slice(0, i).reduce((s, n) => s + (n.duration_ms ?? 0), 0) / totalMs * 100;
          const hue = NODE_COLORS[i] ?? "var(--amber)";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)",
                  width: 170, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {node.node}
              </span>
              <div style={{ flex: 1, height: 18, background: "var(--bg-secondary)", position: "relative", overflow: "hidden" }}>
                <div
                  style={{
                    position: "absolute", top: 0, height: "100%",
                    left: `${offset}%`, width: `${barWidth}%`,
                    background: hue, minWidth: 2,
                    display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--bg-primary)", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {dur >= 1000 ? `${(dur / 1000).toFixed(1)}s` : `${dur}ms`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Node table */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {trace.map((node, i) => (
          <div
            key={i}
            style={{
              display: "grid", gridTemplateColumns: "auto 1fr 1fr auto",
              gap: 16, padding: "10px 0",
              borderBottom: i < trace.length - 1 ? "1px solid var(--border)" : "none",
              alignItems: "start",
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: NODE_COLORS[i] ?? "var(--amber)", fontWeight: 700, paddingTop: 1 }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", fontWeight: 600, marginBottom: 3 }}>
                {node.node}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                IN: {node.input_summary}
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              OUT: {node.output_summary}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", textAlign: "right", whiteSpace: "nowrap" }}>
              {node.duration_ms == null ? "—" : node.duration_ms >= 1000 ? `${(node.duration_ms / 1000).toFixed(2)}s` : `${node.duration_ms}ms`}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
