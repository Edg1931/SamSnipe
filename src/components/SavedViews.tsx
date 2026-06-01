"use client";

import { useState } from "react";
import type { SavedView } from "@/lib/views";

// One-tap saved filter/sort combos. Apply, save the current combo, or delete.
export function SavedViews({
  views, isActive, onApply, onSave, onDelete,
}: {
  views: SavedView[];
  isActive: (v: SavedView) => boolean;
  onApply: (v: SavedView) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const commit = () => {
    const n = name.trim();
    if (n) onSave(n);
    setName("");
    setAdding(false);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-text-faint">Views:</span>
      {views.length === 0 && !adding && (
        <span className="text-[11px] text-text-faint">none yet — set filters, then save them</span>
      )}
      {views.map((v) => {
        const active = isActive(v);
        return (
          <span
            key={v.id}
            className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-[11px] font-medium transition ${
              active ? "border-accent/50 bg-accent/15 text-accent" : "border-border bg-white/5 text-text-dim"
            }`}
          >
            <button onClick={() => onApply(v)} className="hover:text-text" title="Apply view">{v.name}</button>
            <button onClick={() => onDelete(v.id)} className="grid h-3.5 w-3.5 place-items-center rounded-full text-text-faint hover:bg-white/10 hover:text-danger" aria-label={`Delete ${v.name}`}>×</button>
          </span>
        );
      })}
      {adding ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setAdding(false); setName(""); } }}
            placeholder="Name this view"
            className="w-32 rounded-full border border-border bg-black/30 px-3 py-1 text-[11px] text-text outline-none focus:border-accent/50"
          />
          <button onClick={commit} className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-black hover:opacity-90">Save</button>
        </span>
      ) : (
        <button onClick={() => setAdding(true)} className="rounded-full border border-dashed border-border px-3 py-1 text-[11px] text-text-dim hover:border-accent/40 hover:text-text">+ Save current</button>
      )}
    </div>
  );
}
