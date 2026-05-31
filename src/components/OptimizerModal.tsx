"use client";

import { useMemo, useState } from "react";
import type { Deal } from "@/lib/types";
import { optimizeBasket } from "@/lib/optimizer";
import { usd } from "@/lib/format";

// "Best $X you can spend today" — turns the feed into an optimal buy plan.
export function OptimizerModal({
  deals, onClose, onAddBasket,
}: {
  deals: Deal[];
  onClose: () => void;
  onAddBasket: (picks: { deal: Deal; qty: number }[]) => void;
}) {
  const [budget, setBudget] = useState(2000);
  const [safeOnly, setSafeOnly] = useState(true);

  const result = useMemo(
    () => optimizeBasket(deals, { budget, minSurvival: safeOnly ? 60 : 0 }),
    [deals, budget, safeOnly]
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-rise relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Capital optimizer</h2>
            <p className="text-[11px] text-text-dim">The best basket your budget can buy today.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-text-faint">Budget</span>
            <div className="mt-1 flex items-center rounded-lg border border-border bg-black/30 px-2">
              <span className="text-text-faint">$</span>
              <input
                type="number" value={budget} onChange={(e) => setBudget(Math.max(0, +e.target.value))}
                className="w-28 bg-transparent py-1.5 pl-1 text-sm text-text outline-none"
              />
            </div>
          </label>
          <label className="flex items-center gap-2 pb-2 text-[12px] text-text-dim">
            <input type="checkbox" checked={safeOnly} onChange={(e) => setSafeOnly(e.target.checked)} className="accent-[#10d98e]" />
            Account-safe only (survival ≥ 60)
          </label>
        </div>

        {/* Plan summary */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <Stat label="Spend" value={usd(result.spend)} />
          <Stat label="Units" value={String(result.units)} />
          <Stat label="Proj. profit" value={usd(result.profit)} tone="#10d98e" />
          <Stat label="ROI" value={`${result.roi}%`} tone="#f5a524" />
        </div>
        <p className="mt-2 text-[11px] text-text-dim">
          {result.picks.length === 0
            ? "No deals fit those constraints — raise the budget or loosen the safety floor."
            : `${result.picks.length} products selected, ${usd(result.leftover)} left over. Quantities are capped at ~1 month of sell-through so you don't overbuy.`}
        </p>

        {/* Picks */}
        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
          {result.picks.map((p) => (
            <div key={p.deal.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-black/20 p-2.5">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white/90"
                style={{ background: `linear-gradient(135deg, ${p.deal.imageColor}, ${p.deal.imageColor}99)` }}
              >
                {p.deal.brand.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-text">{p.deal.title}</div>
                <div className="text-[10px] text-text-dim">{p.deal.roi}% ROI · {p.deal.source}</div>
              </div>
              <div className="shrink-0 text-right text-[11px]">
                <div className="font-semibold text-text">×{p.qty}</div>
                <div className="text-text-dim">{usd(p.spend)}</div>
              </div>
              <div className="shrink-0 text-right text-[11px] font-semibold text-accent">+{usd(p.profit)}</div>
            </div>
          ))}
        </div>

        {result.picks.length > 0 && (
          <button
            onClick={() => { onAddBasket(result.picks.map((p) => ({ deal: p.deal, qty: p.qty }))); onClose(); }}
            className="mt-4 rounded-xl bg-accent py-2.5 text-center text-[13px] font-semibold text-black hover:opacity-90"
          >
            Add this basket to buy list
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-black/20 p-2.5 text-center">
      <div className="text-[9px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className="text-base font-bold" style={{ color: tone ?? "#e8edf4" }}>{value}</div>
    </div>
  );
}
