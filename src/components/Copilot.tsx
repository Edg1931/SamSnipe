"use client";

import { useEffect, useRef, useState } from "react";
import type { Deal } from "@/lib/types";

interface Turn { role: "user" | "assistant"; content: string }

// Conversational sourcing copilot. Sends the current feed + the user's Buy/Pass
// history so it can rank deals to their taste and explain trade-offs.
export function Copilot({
  deals, decisions, aiOn, onClose,
}: {
  deals: Deal[];
  decisions: { bought: string[]; passed: string[] };
  aiOn: boolean;
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([{
    role: "assistant",
    content: aiOn
      ? "Hey — I'm your sourcing copilot. I can see your current feed and learn from what you buy and pass on. Ask me things like \"which 3 should I buy?\" or \"find me cheaper toys with fast sell-through.\""
      : "Copilot is in offline mode (no ANTHROPIC_API_KEY). Add the key to .env.local to chat with me about your feed. I'll still happily take requests once I'm online.",
  }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...turns, { role: "user" as const, content: text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: next, deals, decisions }),
      });
      const data = await res.json();
      setTurns((t) => [...t, { role: "assistant", content: data.reply ?? data.error ?? "(no reply)" }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Something went wrong reaching the copilot." }]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = ["Which 3 should I buy?", "Best ROI with low risk?", "Avoid anything that won't sell"];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass animate-rise relative flex h-full w-full max-w-md flex-col border-l border-border">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">✦</span>
            <div>
              <h2 className="text-sm font-semibold text-text">Sourcing copilot</h2>
              <div className="flex items-center gap-1.5 text-[10px] text-text-dim">
                <span className={`h-1.5 w-1.5 rounded-full ${aiOn ? "bg-accent" : "bg-warn"}`} />
                {aiOn ? "Claude online · learns from your buys" : "offline — add API key"}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                  t.role === "user" ? "bg-accent text-black" : "border border-border bg-black/20 text-text"
                }`}
              >
                {t.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-black/20 px-3 py-2 text-[12px] text-text-dim">
                <Spinner /> thinking…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {turns.length <= 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => setInput(s)} className="rounded-full border border-border bg-white/5 px-2.5 py-1 text-[11px] text-text-dim hover:text-text">
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-black/30 px-3 py-2 focus-within:border-accent/50">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask your copilot…"
              className="w-full bg-transparent text-[13px] text-text placeholder:text-text-faint outline-none"
            />
            <button onClick={send} disabled={busy || !input.trim()} className="rounded-lg bg-accent px-3 py-1 text-[12px] font-semibold text-black disabled:opacity-50">Send</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
