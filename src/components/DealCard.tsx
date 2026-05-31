import type { MouseEvent } from "react";
import type { Deal } from "@/lib/types";
import { usd, timeAgo, compact } from "@/lib/format";
import { ConfidenceRing, VerdictBadge, RiskChip, SurvivalShield } from "./Badges";
import { Sparkline } from "./Sparkline";
import { computeSurvival } from "@/lib/survival";
import { estimateVelocity } from "@/lib/velocity";
import { assessTrust } from "@/lib/trust";
import { resolveSourceUrl, amazonUrl, keepaUrl, amazonSearch } from "@/lib/links";

export function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const roiColor = deal.roi >= 40 ? "#10d98e" : deal.roi >= 25 ? "#84cc16" : deal.roi >= 15 ? "#f5a524" : "#f4476b";
  const survival = computeSurvival(deal);
  const v = estimateVelocity(deal);
  const trust = assessTrust(deal);
  const srcUrl = resolveSourceUrl({ source: deal.source, title: deal.title, sourceUrl: deal.sourceUrl });
  const azUrl = amazonUrl(deal.match.asin) ?? amazonSearch(`${deal.brand} ${deal.title}`);
  const keUrl = keepaUrl(deal.match.asin);
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="card-hover animate-rise glass group w-full cursor-pointer rounded-2xl border border-border p-4 text-left"
    >
      <div className="flex items-start gap-3">
        {deal.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={deal.imageUrl} alt={deal.title} className="h-14 w-14 shrink-0 rounded-xl bg-white/5 object-contain p-1" />
        ) : (
          <div
            className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-lg font-bold text-white/90"
            style={{ background: `linear-gradient(135deg, ${deal.imageColor}, ${deal.imageColor}99)` }}
          >
            {deal.brand.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-text">{deal.title}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <SurvivalShield score={survival.score} band={survival.band} />
              <VerdictBadge verdict={deal.verdict} />
            </div>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-text-dim">
            <span className="font-mono text-accent">{deal.match.asin}</span>
            <span className="text-text-faint">·</span>
            <span>{deal.category}</span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium"
              style={{ color: trust.color, background: `${trust.color}1f` }}
              title={trust.notes.join(" ")}
            >
              <span className="h-1 w-1 rounded-full" style={{ background: trust.color }} />
              {trust.level === "verified" ? "Verified" : trust.level === "lead" ? "Lead" : trust.level === "demo" ? "Demo" : "Est"}
            </span>
            {trust.stale && <span className="text-[9px] font-medium text-warn" title="Price may be out of date">⏱ stale</span>}
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
          <div>
            <span className="font-medium text-text">~{compact(v.unitsLow)}–{compact(v.unitsHigh)}/mo</span>
            {" · "}{deal.offerCount} offers · {v.decay} decay
          </div>
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

      {/* Quick verify — check the prices behind the ROI without opening the drawer */}
      <div className="mt-2 flex items-center gap-2.5 text-[10px] text-text-faint">
        <span>Verify:</span>
        <a href={srcUrl} target="_blank" rel="noopener noreferrer" onClick={stop} className="text-accent hover:underline" title={`Buy price on ${deal.source}`}>
          {deal.source} ↗
        </a>
        <a href={azUrl} target="_blank" rel="noopener noreferrer" onClick={stop} className="text-accent hover:underline" title="Sell price on Amazon">
          Amazon ↗
        </a>
        {keUrl && (
          <a href={keUrl} target="_blank" rel="noopener noreferrer" onClick={stop} className="text-accent hover:underline" title="Price & BSR history on Keepa">
            Keepa ↗
          </a>
        )}
      </div>
    </div>
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
