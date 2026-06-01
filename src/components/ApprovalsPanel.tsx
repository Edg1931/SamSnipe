"use client";

import { useState } from "react";
import type { Approvals } from "@/lib/ungating";
import { useEscape } from "@/lib/hooks";

const CATEGORIES = ["Toys", "Electronics", "Home & Kitchen", "Sports & Outdoors", "Beauty", "Health & Household", "Grocery", "Tools & Home Improvement"];

// #3 Manage which brands & categories you're ungated (approved) to sell, so the
// agent knows what you can actually list — and flags ungating opportunities.
export function ApprovalsPanel({
  approvals, onChange, onClose,
}: {
  approvals: Approvals;
  onChange: (a: Approvals) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const [brand, setBrand] = useState("");

  const addBrand = () => {
    const b = brand.trim();
    if (b && !approvals.brands.some((x) => x.toLowerCase() === b.toLowerCase())) {
      onChange({ ...approvals, brands: [...approvals.brands, b].sort((a, c) => a.localeCompare(c)) });
    }
    setBrand("");
  };
  const removeBrand = (b: string) => onChange({ ...approvals, brands: approvals.brands.filter((x) => x !== b) });
  const toggleCat = (c: string) =>
    onChange({
      ...approvals,
      categories: approvals.categories.includes(c)
        ? approvals.categories.filter((x) => x !== c)
        : [...approvals.categories, c],
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass animate-rise relative h-full w-full max-w-md overflow-y-auto border-l border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Your ungating approvals</h2>
            <p className="text-[11px] text-text-dim">What you&apos;re cleared to sell on Amazon US.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        {/* Categories */}
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Approved categories</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const on = approvals.categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCat(c)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    on ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-white/5 text-text-dim hover:text-text"
                  }`}
                >
                  {on ? "✓ " : ""}{c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Brands */}
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Approved brands</div>
          <div className="mt-1.5 flex gap-2">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBrand()}
              placeholder="e.g. Nike"
              className="flex-1 rounded-lg border border-border bg-black/30 px-3 py-2 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/50"
            />
            <button onClick={addBrand} className="rounded-lg bg-accent px-4 text-[13px] font-semibold text-black hover:opacity-90">Add</button>
          </div>
          {approvals.brands.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {approvals.brands.map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[12px] font-medium text-accent">
                  {b}
                  <button onClick={() => removeBrand(b)} className="text-accent/70 hover:text-accent">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="mt-5 rounded-xl border border-border bg-black/20 p-3 text-[11px] leading-relaxed text-text-dim">
          Deals in gated brands/categories you haven&apos;t approved are flagged <span className="text-[#f88aa1]">Gated — approval needed</span>.
          When a gated deal comes from a wholesale source, SamSnipe flags it as a chance to <span className="text-warn">ungate</span> the brand —
          keep that invoice in your compliance vault.
        </p>
      </aside>
    </div>
  );
}
