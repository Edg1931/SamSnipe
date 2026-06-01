"use client";

import { useEffect, useRef, useState } from "react";

// One primary control that replaces the separate "Run Scan" + "AI Discover"
// buttons. Primary click refreshes tracked sources; the caret opens explicit
// modes (sources / AI web / both) so the difference is clear.
export function FindDeals({
  scanning, discovering, aiOn, onScan, onDiscover, onBoth,
}: {
  scanning: boolean;
  discovering: boolean;
  aiOn: boolean;
  onScan: () => void;
  onDiscover: () => void;
  onBoth: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const busy = scanning || discovering;
  const label = scanning ? "Scanning…" : discovering ? "Searching web…" : "Find deals";

  return (
    <div ref={ref} className="relative shrink-0">
      <div className="flex">
        <button
          onClick={onScan} disabled={busy}
          className="flex items-center gap-2 rounded-l-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-primary-dim disabled:opacity-60"
          title="Refresh your tracked sources for fresh deals"
        >
          {busy ? <Spinner /> : <Bolt />}
          <span className="hidden sm:inline">{label}</span>
        </button>
        <button
          onClick={() => setOpen((o) => !o)} disabled={busy}
          aria-label="Find options"
          className="rounded-r-xl border-l border-white/20 bg-primary px-2 py-2.5 text-white transition hover:bg-primary-dim disabled:opacity-60"
        >
          <Caret />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-bg-card shadow-2xl">
          <Item onClick={() => { setOpen(false); onScan(); }} title="Refresh tracked sources" desc="Re-check your stores for fresh deals" />
          <Item onClick={() => { setOpen(false); onDiscover(); }} title="AI web search" desc={aiOn ? "Claude scans the open web" : "Needs an Anthropic key"} dim={!aiOn} />
          <Item onClick={() => { setOpen(false); onBoth(); }} title="Sources + AI web" desc="Run both at once" />
        </div>
      )}
    </div>
  );
}

function Item({ onClick, title, desc, dim }: { onClick: () => void; title: string; desc: string; dim?: boolean }) {
  return (
    <button onClick={onClick} className="block w-full px-3.5 py-2.5 text-left transition hover:bg-white/5">
      <div className={`text-[13px] font-medium ${dim ? "text-text-dim" : "text-text"}`}>{title}</div>
      <div className="text-[11px] text-text-faint">{desc}</div>
    </button>
  );
}

function Bolt() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>;
}
function Caret() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>;
}
function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
