"use client";

import { useState } from "react";
import type { Deal } from "@/lib/types";
import type { SavedSearch } from "@/lib/autopilot";
import { addSearch, matchCount } from "@/lib/autopilot";

// Control surface for automated deal-finding. Each saved brief shows how many
// current finds match, and runs in one click.
export function AutoPilotPanel({
  searches, deals, onChange, onRun, onClose,
}: {
  searches: SavedSearch[];
  deals: Deal[];
  onChange: (s: SavedSearch[]) => void;
  onRun: (query: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");

  const add = () => {
    if (!query.trim()) return;
    onChange(addSearch(searches, name, query));
    setName(""); setQuery("");
  };
  const toggle = (id: string) => onChange(searches.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  const remove = (id: string) => onChange(searches.filter((s) => s.id !== id));

  const liveBuys = searches.filter((s) => s.enabled).reduce((a, s) => a + matchCount(s, deals).buys, 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass animate-rise relative h-full w-full max-w-md overflow-y-auto border-l border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-accent">⚡</span>
              Auto-Pilot
            </h2>
            <p className="mt-0.5 text-[11px] text-text-dim">Saved briefs the agent watches for you.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-3 text-[12px] text-text">
          <span className="font-semibold text-accent">{liveBuys}</span> BUY-grade finds match your active watches right now.
        </div>

        {/* New watch */}
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">New watch</div>
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Clearance toys)"
            className="w-full rounded-lg border border-border bg-black/30 px-3 py-2 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/50"
          />
          <div className="flex gap-2">
            <input
              value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Brief: toys under $20, 50% ROI, BSR < 100k"
              className="flex-1 rounded-lg border border-border bg-black/30 px-3 py-2 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/50"
            />
            <button onClick={add} className="rounded-lg bg-accent px-4 text-[13px] font-semibold text-black hover:opacity-90">Save</button>
          </div>
        </div>

        {/* Watch list */}
        <div className="mt-4 space-y-2">
          {searches.map((s) => {
            const m = matchCount(s, deals);
            return (
              <div key={s.id} className="rounded-xl border border-border bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-text">{s.name}</span>
                      {m.buys > 0 && (
                        <span className="shrink-0 rounded-md bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">{m.buys} BUY now</span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-text-dim">“{s.query}”</p>
                    <p className="text-[10px] text-text-faint">{m.total} match · {m.buys} BUY-grade</p>
                  </div>
                  <button onClick={() => toggle(s.id)} className={`relative h-5 w-9 shrink-0 rounded-full transition ${s.enabled ? "bg-accent" : "bg-white/15"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${s.enabled ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => onRun(s.query)} className="flex-1 rounded-lg bg-accent/15 py-1.5 text-[12px] font-semibold text-accent hover:bg-accent/20">Run now</button>
                  <button onClick={() => remove(s.id)} className="rounded-lg border border-border bg-white/5 px-3 text-[12px] text-text-dim hover:text-danger">Delete</button>
                </div>
              </div>
            );
          })}
          {searches.length === 0 && (
            <p className="rounded-xl border border-dashed border-border py-8 text-center text-[12px] text-text-dim">No watches yet — save a brief above.</p>
          )}
        </div>

        <p className="mt-4 rounded-xl border border-border bg-black/20 p-3 text-[11px] leading-relaxed text-text-dim">
          Next: enabled watches run on a schedule in the background (Vercel Cron + Supabase) and ping you the moment a new
          high-ROI, account-safe match appears — true hands-off sourcing.
        </p>
      </aside>
    </div>
  );
}
