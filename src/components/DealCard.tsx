import type { Deal } from "@/lib/types";
import { usd, timeAgo, compact } from "@/lib/format";
import { ConfidenceRing, VerdictBadge, RiskChip } from "./Badges";
import { Sparkline } from "./Sparkline";

export function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const roiColor = deal.roi >= 40 ? "#10d98e" : deal.roi >= 25 ? "#84cc16" : deal.roi >= 15 ? "#f5a524" : "#f4476b";
  return (
    <button
      onClick={onClick}
      className="card-hover animate-rise glass group w-full rounded-2xl border border-border p-4 text-left"
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-lg font-bold text-white/90"
          style={{ background: `linear-gradient(135deg, ${deal.imageColor}, ${deal.imageColor}99)` }}
        >
          {deal.brand.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-text">{deal.title}</span>
            <VerdictBadge verdict={deal.verdict} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-text-dim">
            <span className="font-mono text-accent">{deal.match.asin}</span>
            <span className="text-text-faint">·</span>
            <span>{deal.category}</span>
            {deal.origin !== "scan" && (
              <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-text-faint">
                {deal.origin === "import" ? "Imported" : "Web"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ConfidenceRing match={deal.match} />
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-text-faint">ASIN match</span>
            <span className="text-[11px] text-text-dim">
              {deal.match.packSizeWarning ? "⚠ verify pack size" : "verified"}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-dim">{deal.match.rationale}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-black/20 p-2.5">
        <Stat label="Cost" value={usd(deal.sourcePrice)} sub={deal.source} />
        <Stat label="Sells" value={usd(deal.amazonPrice)} sub="Amazon" />
        <Stat label="Profit" value={usd(deal.profit)} sub={`${deal.margin}% margin`} accent="#e8edf4" />
        <Stat label="ROI" value={`${deal.roi}%`} sub={`${usd(deal.fbaFees)} fees`} accent={roiColor} />
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div className="space-y-1 text-[11px] text-text-dim">
          <div>BSR <span className="font-medium text-text">#{compact(deal.bsr)}</span> in {deal.bsrCategory}</div>
          <div>~{compact(deal.monthlySales)}/mo · {deal.offerCount} offers</div>
        </div>
        <Sparkline data={deal.priceHistory} color={deal.imageColor} />
      </div>

      {deal.risks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {deal.risks.map((r) => <RiskChip key={r} risk={r} />)}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border-soft pt-2.5">
        <span className="line-clamp-1 text-[11px] italic text-text-dim">“{deal.verdictReason}”</span>
        <span className="shrink-0 pl-2 text-[10px] text-text-faint">{timeAgo(deal.foundAt)}</span>
      </div>
    </button>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className="truncate text-sm font-bold" style={{ color: accent ?? "#e8edf4" }}>{value}</div>
      {sub && <div className="truncate text-[9px] text-text-faint">{sub}</div>}
    </div>
  );
}
