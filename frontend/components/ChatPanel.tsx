"use client";

import { useRef, useState } from "react";
import Panel from "./Panel";
import SectionLabel from "./SectionLabel";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function ChatPanel({ researchId }: { researchId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);
    try {
      const r = await fetch(`http://localhost:8000/api/research/${researchId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: AbortSignal.timeout(60_000),
      });
      const d = await r.json();
      setMessages(prev => [...prev, { role: "assistant", text: d.answer || d.detail || "No response" }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${e}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const SUGGESTIONS = ["Why is this a BUY?", "What are the biggest risks?", "How does valuation look?", "What could change the thesis?"];

  return (
    <Panel>
      <SectionLabel color="var(--amber)">FOLLOW-UP Q&amp;A</SectionLabel>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginBottom: 16, letterSpacing: "0.05em" }}>
        Ask anything about this research — grounded in the analysis above
      </p>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setInput(s); inputRef.current?.focus(); }}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 10px",
                background: "var(--bg-secondary)", border: "1px solid var(--border)",
                color: "var(--text-secondary)", cursor: "pointer", letterSpacing: "0.05em",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--amber)"; e.currentTarget.style.color = "var(--amber)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16, maxHeight: 320, overflowY: "auto" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
                  color: m.role === "user" ? "var(--amber)" : "var(--cyan)",
                  letterSpacing: "0.1em", flexShrink: 0, paddingTop: 2, minWidth: 28,
                }}
              >
                {m.role === "user" ? "YOU" : "AI"}
              </div>
              <div
                style={{
                  fontFamily: m.role === "user" ? "var(--font-mono)" : "var(--font-sans)",
                  fontSize: m.role === "user" ? 12 : 13,
                  color: m.role === "user" ? "var(--text-primary)" : "var(--text-secondary)",
                  lineHeight: 1.6, fontWeight: 300,
                  background: m.role === "assistant" ? "var(--bg-secondary)" : "transparent",
                  padding: m.role === "assistant" ? "10px 12px" : "0",
                  borderLeft: m.role === "assistant" ? "2px solid var(--cyan)" : "none",
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--cyan)", minWidth: 28 }}>AI</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--cyan)", opacity: 0.6 }} className="animate-blink" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 0, border: "1px solid var(--border)", transition: "border-color 0.2s" }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask about this analysis…"
          style={{
            flex: 1, background: "var(--bg-secondary)", border: "none",
            padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12,
            color: "var(--text-primary)", outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            padding: "10px 16px", background: input.trim() && !loading ? "var(--amber)" : "var(--bg-panel)",
            border: "none", color: input.trim() && !loading ? "#000" : "var(--text-dim)",
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            letterSpacing: "0.08em", transition: "all 0.2s",
          }}
        >
          ASK
        </button>
      </div>
    </Panel>
  );
}
