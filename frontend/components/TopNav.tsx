"use client";

interface Props {
  onReset?: () => void;
  onHistory?: () => void;
}

export default function TopNav({ onReset, onHistory }: Props) {
  return (
    <div
      data-noprint
      style={{
        height: 52,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: "var(--amber)",
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.04em",
              color: "var(--text-primary)",
            }}
          >
            EQUITY<span style={{ color: "var(--amber)" }}>AGENT</span>
          </span>
        </div>
        <div style={{ width: 1, height: 20, background: "var(--border)" }} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-dim)",
            letterSpacing: "0.08em",
          }}
        >
          AI RESEARCH TERMINAL v2.1
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          <span style={{ color: "var(--green)" }}>●</span> API LIVE
        </div>
        <button
          onClick={onHistory}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            padding: "5px 12px",
            cursor: "pointer",
            letterSpacing: "0.08em",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--cyan)";
            e.currentTarget.style.color = "var(--cyan)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-dim)";
          }}
        >
          HISTORY
        </button>
        {onReset && (
          <button
            onClick={onReset}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              padding: "5px 12px",
              cursor: "pointer",
              letterSpacing: "0.08em",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--amber)";
              e.currentTarget.style.color = "var(--amber)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            NEW QUERY
          </button>
        )}
      </div>
    </div>
  );
}
