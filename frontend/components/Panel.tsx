import { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function Panel({ children, className, style }: Props) {
  return (
    <div
      className={className}
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
