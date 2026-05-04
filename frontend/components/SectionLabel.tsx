import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  color?: string;
}

export default function SectionLabel({ children, color = "var(--amber)" }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 3, height: 16, background: color, flexShrink: 0 }} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.16em",
          color: "var(--text-secondary)",
          textTransform: "uppercase",
        }}
      >
        {children}
      </span>
    </div>
  );
}
