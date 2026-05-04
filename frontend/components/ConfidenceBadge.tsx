"use client";

interface Props {
  value: number;
  large?: boolean;
}

export default function ConfidenceBadge({ value, large }: Props) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.7 ? "var(--green)" : value >= 0.4 ? "var(--yellow)" : "var(--red)";
  const glow =
    value >= 0.7
      ? "var(--green-glow)"
      : value >= 0.4
      ? "rgba(245,197,24,0.12)"
      : "var(--red-glow)";
  const label = value >= 0.7 ? "HIGH" : value >= 0.4 ? "MEDIUM" : "LOW";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: large ? 8 : 6,
        padding: large ? "6px 12px" : "3px 8px",
        border: `1px solid ${color}`,
        background: glow,
        fontFamily: "var(--font-mono)",
        fontSize: large ? 13 : 11,
        fontWeight: 600,
        color,
        letterSpacing: "0.08em",
      }}
    >
      <div
        style={{
          width: large ? 8 : 6,
          height: large ? 8 : 6,
          borderRadius: "50%",
          background: color,
        }}
        className={value >= 0.7 ? "animate-pulse-green" : ""}
      />
      <span>{pct}%</span>
      <span style={{ opacity: 0.6, fontWeight: 400 }}>{label}</span>
    </div>
  );
}
