"use client";

import { useState } from "react";
import type { TargetSite } from "@/lib/sources";
import { parseSiteInput } from "@/lib/sources";
import { storeHomeUrl } from "@/lib/links";
import { useEscape } from "@/lib/hooks";

// Manage the specific sites the agent searches + the AI web-search toggle.
export function SourcesPanel({
  sites, aiSearch, onChange, onAiChange, onClose,
}: {
  sites: TargetSite[];
  aiSearch: boolean;
  onChange: (s: TargetSite[]) => void;
  onAiChange: (on: boolean) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const [input, setInput] = useState("");

  function add() {
    const parsed = parseSiteInput(input);
    if (!parsed) return;
    if (sites.some((s) => s.domain === parsed.domain)) { setInput(""); return; }
    onChange([
      ...sites,
      { id: parsed.domain, label: parsed.label, domain: parsed.domain, enabled: true, custom: true },
    ]);
    setInput("");
  }

  const toggle = (id: string) =>
    onChange(sites.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  const remove = (id: string) => onChange(sites.filter((s) => s.id !== id));

  const enabledCount = sites.filter((s) => s.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass animate-rise relative h-full w-full max-w-md overflow-y-auto border-l border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Search sources</h2>
            <p className="text-[11px] text-text-dim">Tell the agent exactly where to hunt.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        {/* AI web search toggle */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-accent/20 bg-accent/5 p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">✦</span>
            <div>
              <div className="text-[13px] font-medium text-text">AI web search</div>
              <div className="text-[11px] text-text-dim">Scan the open web for deals beyond your sites.</div>
            </div>
          </div>
          <Toggle on={aiSearch} onClick={() => onAiChange(!aiSearch)} />
        </div>

        {/* Add a site */}
        <div className="mt-4">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Add a specific site</label>
          <div className="mt-1.5 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="walmart.com  or  a full clearance URL"
              className="flex-1 rounded-lg border border-border bg-black/30 px-3 py-2 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/50"
            />
            <button onClick={add} className="rounded-lg bg-primary px-4 text-[13px] font-semibold text-white hover:opacity-90">Add</button>
          </div>
          <p className="mt-1 text-[10px] text-text-faint">Paste a category/clearance URL to point the crawler straight at it.</p>
        </div>

        {/* Site list */}
        <div className="mt-4 space-y-2">
          {sites.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-black/20 p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-[11px] font-bold text-text-dim">
                  {s.label.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="text-[13px] font-medium text-text">{s.label}</div>
                  <a
                    href={storeHomeUrl(s.domain)} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-text-faint hover:text-accent hover:underline"
                    title={`Open ${s.domain} to verify the store`}
                  >
                    {s.domain} ↗{s.custom && <span className="text-text-faint"> · custom</span>}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Toggle on={s.enabled} onClick={() => toggle(s.id)} />
                {s.custom && (
                  <button onClick={() => remove(s.id)} className="rounded-md p-1 text-text-faint hover:text-danger" title="Remove">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-border bg-black/20 p-3 text-[11px] text-text-dim">
          Next scan will search <span className="font-semibold text-text">{enabledCount}</span> site{enabledCount === 1 ? "" : "s"}
          {aiSearch && <> + <span className="font-semibold text-accent">AI web search</span></>}.
        </div>
      </aside>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-white/15"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
