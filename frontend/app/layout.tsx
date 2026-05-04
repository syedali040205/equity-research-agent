import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EquityAgent — AI Research Terminal",
  description: "Multi-agent AI equity research: deep brief, live market data, critic review, full agent trace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {children}
      </body>
    </html>
  );
}
