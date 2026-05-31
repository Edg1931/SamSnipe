"use client";

import { useState } from "react";
import type { Deal } from "@/lib/types";
import { usd, compact, RISK_LABELS } from "@/lib/format";
import { calcProfit } from "@/lib/profit";
import { ConfidenceRing, VerdictBadge, RiskChip } from "./Badges";
import { Sparkline } from "./Sparkline";

// Slide-over with the full deal breakdown + a live what-if profit calculator.
export function DealDetail({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const [cost, setCost] = useState(deal.sourcePrice);
  const [sell, setSell] = useState(deal.amazonPrice);
  const p = calcProfit({ cost, sellPrice: sell, category: deal.category });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass animate-rise relative h-full w-full max-w-md overflow-y-auto border-l border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 place-items-center rounded-xl font-bold text-white/90"
              style={{ background: `linear-gradient(135deg, ${deal.imageColor}, ${deal.imageColor}99)` }}
            >
              {deal.brand.slice(0, 2)}
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight text-text">{deal.title}</h2>
              <p className="text-[11px] text-text-dim">{deal.brand} · {deal.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-black/20 p-3">
          <div className="flex items-center gap-3">
            <ConfidenceRing match={deal.match} size={52} />
            <div>
              <div className="font-mono text-sm text-accent">{deal.match.asin}</div>
              <div className="text-[11px] text-text-dim">via {deal.match.method.join(" + ")}</div>
            </div>
          </div>
          <VerdictBadge verdict={deal.verdict} />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-dim">{deal.match.rationale}</p>

        {/* AI verdict */}
        <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            <Spark /> AI verdict
          </div>
          <p className="text-[12px] leading-relaxed text-text">{deal.verdictReason}</p>
        </div>

        {/* Price history */}
        <div className="mt-4 rounded-xl border border-border bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-text-dim">
            <span>90-day Amazon price</span>
            <span>BSR #{compact(deal.bsr)} · ~{compact(deal.monthlySales)}/mo</span>
          </div>
          <Sparkline data={deal.priceHistory} width={380} height={90} color={deal.imageColor} />
        </div>

        {/* Live profit calculator */}
        <div className="mt-4 rounded-xl border border-border bg-black/20 p-3">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-dim">Profit calculator</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Your cost" value={cost} onChange={setCost} />
            <Field label="Sell price" value={sell} onChange={setSell} />
          </div>
          <div className="mt-3 space-y-1.5 text-[12px]">
            <Row label="Referral fee" value={`−${usd(p.referralFee)}`} />
            <Row label="FBA fee" value={`−${usd(p.fbaFee)}`} />
            <Row label="Breakeven sell price" value={usd(p.breakeven)} />
            <div className="my-2 h-px bg-border" />
            <Row label="Net profit / unit" value={usd(p.profit)} strong color={p.profit > 0 ? "#10d98e" : "#f4476b"} />
            <Row label="ROI" value={`${p.roi}%`} strong color={p.roi >= 30 ? "#10d98e" : "#f5a524"} />
            <Row label="Margin" value={`${p.margin}%`} />
          </div>
        </div>

        {/* Risks */}
        {deal.risks.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-dim">Risk radar</div>
            <div className="flex flex-wrap gap-1.5">
              {deal.risks.map((r) => <RiskChip key={r} risk={r} />)}
            </div>
            <ul className="mt-2 space-y-1 text-[11px] text-text-dim">
              {deal.risks.map((r) => <li key={r}>• {RISK_LABELS[r]} — flagged by SamSnipe before purchase.</li>)}
            </ul>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <a
            href={deal.sourceUrl}
            className="rounded-xl border border-border bg-white/5 py-2.5 text-center text-[12px] font-medium text-text hover:bg-white/10"
          >
            View on {deal.source}
          </a>
          <button className="rounded-xl bg-accent py-2.5 text-center text-[12px] font-semibold text-black hover:opacity-90">
            Add to buy list
          </button>
        </div>
        <div className="h-4" />
      </aside>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-text-faint">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-black/30 px-2">
        <span className="text-text-faint">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="w-full bg-transparent py-1.5 pl-1 text-sm text-text outline-none"
        />
      </div>
    </label>
  );
}

function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-dim">{label}</span>
      <span className={strong ? "font-bold" : "font-medium text-text"} style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

function Spark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
    </svg>
  );
}
