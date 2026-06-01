"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/types";
import type { SavedSearch } from "@/lib/autopilot";
import { addSearch, matchCount } from "@/lib/autopilot";
import { timeAgo } from "@/lib/format";
import { useEscape } from "@/lib/hooks";
import { toast } from "@/lib/toast";

interface Findings {
  ranAt: string; totalNew: number; poolSize: number;
  store: "kv" | "memory"; keepaLive: boolean; aiWeb: boolean; demo?: boolean;
  byWatch: { name: string; count: number }[];
}

export function AutoPilotPanel({
  searches, deals, onChange, onRun, onClose, onAddFindings,
}: {
  searches: SavedSearch[];
  deals: Deal[];
  onChange: (s: SavedSearch[]) => void;
  onRun: (query: string) => void;
  onClose: () => void;
  onAddFindings: (deals: Deal[]) => void;
}) {
  useEscape(onClose);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [findings, setFindings] = useState<Findings | null>(null);
  const [inbox, setInbox] = useState<Deal[]>([]);
  const [storeOn, setStoreOn] = useState(false);
  const [backend, setBackend] = useState<string>("memory");
  const [running, setRunning] = useState(false);

  // Keep the server's watch list in sync (so the cron knows what to hunt).
  function persist(next: SavedSearch[]) {
    onChange(next);
    fetch("/api/watches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ searches: next }) }).catch(() => {});
  }

  async function loadFindings() {
    try {
      const r = await fetch("/api/autopilot/findings");
      const d = await r.json();
      setFindings(d.findings ?? null);
      setInbox(Array.isArray(d.inbox) ? d.inbox : []);
      setStoreOn(Boolean(d.storeConfigured));
      if (d.storeBackend) setBackend(d.storeBackend);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const id = setTimeout(() => {
      loadFindings();
      // push current watches up once on open so the cron knows them
      fetch("/api/watches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ searches }) }).catch(() => {});
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runNow() {
    setRunning(true);
    try {
      // The run returns its results inline, so finds show even with no store.
      const r = await fetch("/api/autopilot/run", { method: "POST" });
      const d = await r.json();
      if (d.findings) setFindings(d.findings);
      if (Array.isArray(d.inbox)) setInbox(d.inbox);
      const n = d.findings?.totalNew ?? 0;
      if (n > 0) toast.success(`Auto-Pilot found ${n} new deal${n === 1 ? "" : "s"}`);
      else toast.info("Auto-Pilot ran — no new deals this time");
    } catch {
      toast.error("Auto-Pilot run failed — try again");
    } finally {
      setRunning(false);
    }
  }

  const add = () => {
    if (!query.trim()) return;
    persist(addSearch(searches, name, query));
    setName(""); setQuery("");
  };
  const toggle = (id: string) => persist(searches.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  const remove = (id: string) => persist(searches.filter((s) => s.id !== id));

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
            <p className="mt-0.5 text-[11px] text-text-dim">Saved briefs the agent hunts for you — on demand.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        {/* Server status + run */}
        <div className="mt-4 rounded-xl border border-border bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] text-text">
              <span className={`h-2 w-2 rounded-full ${storeOn ? "bg-accent" : "bg-sky-400"}`} />
              {storeOn ? `On-demand + persistent store · ${backend}` : "On-demand mode"}
            </div>
            <button onClick={runNow} disabled={running} className="rounded-lg bg-primary px-3 py-1 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {running ? "Running…" : "Run now"}
            </button>
          </div>
          {findings ? (
            <p className="mt-2 text-[11px] text-text-dim">
              Last run {timeAgo(findings.ranAt)} · scanned {findings.poolSize} · <span className="font-semibold text-accent">{findings.totalNew} new</span>
              {" · "}Keepa {findings.keepaLive ? "live" : "off"} · web {findings.aiWeb ? "on" : "off"}
              {findings.demo ? " · demo data" : ""}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-text-faint">No run yet — hit “Run now” to hunt your watches.</p>
          )}
          {!storeOn && (
            <p className="mt-1 text-[10px] text-text-faint">Optional: connect a store (Supabase / KV) to remember finds across sessions &amp; skip dupes you&apos;ve seen.</p>
          )}
        </div>

        {/* Inbox of found deals */}
        {inbox.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Findings inbox ({inbox.length})</span>
              <button onClick={() => onAddFindings(inbox)} className="text-[11px] font-medium text-accent hover:underline">Add all to feed</button>
            </div>
            <div className="space-y-1.5">
              {inbox.slice(0, 8).map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-black/20 px-2.5 py-1.5 text-[11px]">
                  <span className="min-w-0 truncate text-text">{d.title}</span>
                  <span className="shrink-0 pl-2 font-mono text-accent">{d.roi}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-3 text-[12px] text-text">
          <span className="font-semibold text-accent">{liveBuys}</span> BUY-grade finds match your active watches in the current feed.
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
            <button onClick={add} className="rounded-lg bg-primary px-4 text-[13px] font-semibold text-white hover:opacity-90">Save</button>
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
                      {m.buys > 0 && <span className="shrink-0 rounded-md bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">{m.buys} BUY now</span>}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-text-dim">“{s.query}”</p>
                  </div>
                  <button onClick={() => toggle(s.id)} className={`relative h-5 w-9 shrink-0 rounded-full transition ${s.enabled ? "bg-accent" : "bg-white/15"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${s.enabled ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => onRun(s.query)} className="flex-1 rounded-lg bg-accent/15 py-1.5 text-[12px] font-semibold text-accent hover:bg-accent/20">Run in feed</button>
                  <button onClick={() => remove(s.id)} className="rounded-lg border border-border bg-white/5 px-3 text-[12px] text-text-dim hover:text-danger">Delete</button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 rounded-xl border border-border bg-black/20 p-3 text-[11px] leading-relaxed text-text-dim">
          Hit <span className="font-medium text-text">Run now</span> and Auto-Pilot scans every enabled watch (Keepa + web), keeps only
          new high-ROI, account-safe finds, and drops them in this inbox. Add a store (Supabase / KV) only if you want finds remembered
          across sessions or scheduled runs.
        </p>
      </aside>
    </div>
  );
}
