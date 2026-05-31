"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/types";
import { usd, compact, RISK_LABELS } from "@/lib/format";
import { calcProfit } from "@/lib/profit";
import { estimateVelocity } from "@/lib/velocity";
import { resolveSourceUrl, amazonUrl } from "@/lib/links";
import { ConfidenceRing, VerdictBadge, RiskChip } from "./Badges";
import { Sparkline } from "./Sparkline";

interface AIVerdict {
  verdict: "BUY" | "WATCH" | "PASS";
  confidence: number;
  reason: string;
  risks: string[];
  keyFactors: string[];
  source: "ai" | "rules";
}

// Slide-over: full deal breakdown, live AI analysis, sell-through model,
// what-if profit calculator, real outbound links, and buy-list actions.
export function DealDetail({
  deal, inBuyList, onClose, onAddToBuyList, onPass,
}: {
  deal: Deal;
  inBuyList: boolean;
  onClose: () => void;
  onAddToBuyList: (deal: Deal) => void;
  onPass: (deal: Deal) => void;
}) {
  const [cost, setCost] = useState(deal.sourcePrice);
  const [sell, setSell] = useState(deal.amazonPrice);
  const p = calcProfit({ cost, sellPrice: sell, category: deal.category });
  const v = estimateVelocity(deal);

  const [ai, setAi] = useState<AIVerdict | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    let live = true;
    // Deferred so we don't setState synchronously in the effect body.
    const id = setTimeout(() => {
      setAiLoading(true);
      setAi(null);
      fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal }),
      })
        .then((r) => r.json())
        .then((d) => { if (live && !d.error) setAi(d); })
        .finally(() => { if (live) setAiLoading(false); });
    }, 0);
    return () => { live = false; clearTimeout(id); };
  }, [deal]);

  const azUrl = amazonUrl(deal.match.asin);
  const srcUrl = resolveSourceUrl({ source: deal.source, title: deal.title, sourceUrl: deal.sourceUrl });

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

        {/* AI analysis */}
        <div className="mt-4 rounded-xl border border-accent/20 bg-accent/5 p-3">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              <Spark /> AI analysis
            </div>
            {ai && (
              <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-text-faint">
                {ai.source === "ai" ? "Claude" : "rules engine"}
              </span>
            )}
          </div>
          {aiLoading ? (
            <div className="flex items-center gap-2 py-1 text-[12px] text-text-dim"><Spinner /> Analyzing deal…</div>
          ) : ai ? (
            <>
              <div className="flex items-center gap-2">
                <VerdictBadge verdict={ai.verdict} />
                <span className="text-[11px] text-text-dim">{ai.confidence}% confidence</span>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-text">{ai.reason}</p>
              {ai.keyFactors?.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {ai.keyFactors.map((f, i) => (
                    <li key={i} className="text-[11px] text-text-dim">• {f}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-[12px] text-text-dim">{deal.verdictReason}</p>
          )}
        </div>

        {/* Sell-through model */}
        <div className="mt-4 rounded-xl border border-border bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-text-dim">
            <span className="font-semibold uppercase tracking-wide">Sell-through forecast</span>
            <span>{v.confidence}% confidence</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Est. sales" value={`${compact(v.unitsLow)}–${compact(v.unitsHigh)}`} sub="units/mo" />
            <Mini label="Your pace" value={`${v.monthsToSellThrough}`} sub="mo to clear" />
            <Mini label="Competition" value={v.decay} sub="decay" />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-text-dim">
            {v.note} Price trend: <span className="text-text">{v.trend}</span>.
          </p>
        </div>

        {/* Price history */}
        <div className="mt-4 rounded-xl border border-border bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-text-dim">
            <span>90-day Amazon price</span>
            <span>BSR #{compact(deal.bsr)} · {deal.offerCount} offers</span>
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
              {deal.risks.map((r) => <li key={r}>• {RISK_LABELS[r]} — flagged before purchase.</li>)}
            </ul>
          </div>
        )}

        {/* Links */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <a
            href={srcUrl} target="_blank" rel="noopener noreferrer"
            className="rounded-xl border border-border bg-white/5 py-2.5 text-center text-[12px] font-medium text-text hover:bg-white/10"
          >
            View on {deal.source} ↗
          </a>
          {azUrl ? (
            <a
              href={azUrl} target="_blank" rel="noopener noreferrer"
              className="rounded-xl border border-border bg-white/5 py-2.5 text-center text-[12px] font-medium text-text hover:bg-white/10"
            >
              Open on Amazon ↗
            </a>
          ) : (
            <span className="rounded-xl border border-border bg-black/20 py-2.5 text-center text-[12px] text-text-faint">No ASIN yet</span>
          )}
        </div>

        {/* Buy-list actions */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => onPass(deal)}
            className="rounded-xl border border-border bg-white/5 py-2.5 text-center text-[12px] font-medium text-text-dim hover:bg-white/10"
          >
            Pass
          </button>
          <button
            onClick={() => onAddToBuyList(deal)}
            disabled={inBuyList}
            className="rounded-xl bg-accent py-2.5 text-center text-[12px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {inBuyList ? "✓ In buy list" : "Add to buy list"}
          </button>
        </div>
        <div className="h-4" />
      </aside>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-black/30 p-2">
      <div className="text-[9px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className="text-sm font-bold capitalize text-text">{value}</div>
      <div className="text-[9px] text-text-faint">{sub}</div>
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
          type="number" value={value}
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

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
