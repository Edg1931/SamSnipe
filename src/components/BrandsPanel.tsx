"use client";

import { useMemo, useState } from "react";
import { parseBrandInput } from "@/lib/brands";
import { useEscape } from "@/lib/hooks";

// Manage the exempt-brand blocklist. Add one at a time or paste many.
export function BrandsPanel({
  brands, suggestions, onChange, onClose,
}: {
  brands: string[];
  /** Brands present in the current feed, offered as quick-add chips. */
  suggestions: string[];
  onChange: (b: string[]) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const [input, setInput] = useState("");

  function add() {
    const added = parseBrandInput(input, brands);
    if (added.length) onChange([...brands, ...added].sort((a, b) => a.localeCompare(b)));
    setInput("");
  }
  const remove = (name: string) => onChange(brands.filter((b) => b !== name));
  const clearAll = () => onChange([]);

  const quickAdd = useMemo(
    () => suggestions.filter((s) => !brands.some((b) => b.toLowerCase() === s.toLowerCase())).slice(0, 12),
    [suggestions, brands]
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass animate-rise relative h-full w-full max-w-md overflow-y-auto border-l border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Exempt brands</h2>
            <p className="text-[11px] text-text-dim">Hide deals from brands you can&apos;t or won&apos;t sell.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        {/* Add / paste */}
        <div className="mt-4">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Add brands</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); }}
            rows={2}
            placeholder="Paste a list — Sony, Nike, Apple, Dyson…  (commas or new lines)"
            className="mt-1.5 w-full resize-none rounded-lg border border-border bg-black/30 px-3 py-2 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/50"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[10px] text-text-faint">⌘/Ctrl+Enter to add</span>
            <button onClick={add} className="rounded-lg bg-primary px-4 py-1.5 text-[12px] font-semibold text-white hover:opacity-90">Add brands</button>
          </div>
        </div>

        {/* Quick-add from current feed */}
        {quickAdd.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Quick-add from current deals</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickAdd.map((s) => (
                <button
                  key={s}
                  onClick={() => onChange([...brands, s].sort((a, b) => a.localeCompare(b)))}
                  className="rounded-full border border-border bg-white/5 px-2.5 py-1 text-[11px] text-text-dim transition hover:border-danger/40 hover:text-text"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current list */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
            Exempted ({brands.length})
          </span>
          {brands.length > 0 && (
            <button onClick={clearAll} className="text-[11px] text-text-faint hover:text-danger">Clear all</button>
          )}
        </div>

        {brands.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border py-6 text-center text-[12px] text-text-dim">
            No exemptions yet — every brand is allowed.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-[12px] font-medium text-[#f88aa1]">
                {b}
                <button onClick={() => remove(b)} className="text-[#f88aa1]/70 hover:text-[#f88aa1]" title="Remove">✕</button>
              </span>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
