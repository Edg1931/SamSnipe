import type { MouseEvent, ReactNode } from "react";
import type { Deal } from "@/lib/types";
import { usd, timeAgo, compact } from "@/lib/format";
import { ConfidenceRing, VerdictBadge, RiskChip, SurvivalShield } from "./Badges";
import { Sparkline } from "./Sparkline";
import { computeSurvival } from "@/lib/survival";
import { estimateVelocity } from "@/lib/velocity";
import { assessTrust, verifiedScore } from "@/lib/trust";
import { dealScore, SCORE_COLOR, scoreGrade } from "@/lib/score";
import { sourceLink, amazonUrl, keepaUrl, amazonSearch } from "@/lib/links";

export function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const roiColor = deal.roi >= 40 ? "#10d98e" : deal.roi >= 25 ? "#84cc16" : deal.roi >= 15 ? "#f5a524" : "#f4476b";
  const survival = computeSurvival(deal);
  const v = estimateVelocity(deal);
  const trust = assessTrust(deal);
  const sc = dealScore(deal);
  const grade = scoreGrade(sc.score);
  const gradeColor = SCORE_COLOR[sc.band];
  // "Real data" confidence ticks — which figures are confirmed vs estimated.
  const ticks = [
    trust.level === "verified" && "Keepa",
    (deal.feesSource === "keepa" || deal.feesSource === "spapi") && "Fees",
    deal.costSource === "live" && "Cost",
  ].filter(Boolean) as string[];
  const vs = verifiedScore(deal);
  // Entry-quality: is the current Amazon price below its 90-day average?
  const priceTrend = deal.avg90 ? (deal.amazonPrice <= deal.avg90 ? "below" : "above") : null;
  const srcUrl = sourceLink(deal);
  // Only deep-link the Amazon/Keepa listing when the ASIN is verified; otherwise
  // search (a fake/unmatched ASIN would 404 or show the wrong product).
  const verified = trust.level === "verified";
  const azUrl = verified ? (amazonUrl(deal.match.asin) ?? amazonSearch(`${deal.brand} ${deal.title}`)) : amazonSearch(`${deal.brand} ${deal.title}`);
  const keUrl = verified ? keepaUrl(deal.match.asin) : null;
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
              <span
                title={`Deal Score ${sc.score}/100 — ROI, account safety & demand`}
                className="grid h-6 min-w-6 place-items-center rounded-md px-1 text-[11px] font-extrabold"
                style={{ color: gradeColor, background: `${gradeColor}1f` }}
              >
                {grade}
              </span>
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
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-faint">ASIN match</span>
            <span className="flex items-center gap-1.5 text-[10px]">
              {deal.match.packSizeWarning && <span className="font-medium text-warn" title="Pack/quantity may differ between source and listing">⚠ pack</span>}
              <span
                className="rounded px-1 py-0.5 font-semibold"
                style={{ color: vs.color, background: `${vs.color}1f` }}
                title="Key figures backed by live data — sell price · buy cost · fees"
              >
                {vs.count}/{vs.total} live
              </span>
              {ticks.map((t) => (
                <span key={t} className="font-medium text-accent" title="Confirmed from a real data source">✓ {t}</span>
              ))}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-dim">{deal.match.rationale}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-black/20 p-2.5">
        <Stat label="Cost" value={usd(deal.sourcePrice)} sub={deal.costSource === "live" ? `${deal.source} · live` : deal.source} />
        <Stat
          label="Sells"
          value={usd(deal.amazonPrice)}
          sub={priceTrend ? (
            <span style={{ color: priceTrend === "below" ? "#10d98e" : "#f5a524" }} title={`90-day avg ${usd(deal.avg90!)}`}>
              {priceTrend === "below" ? "↓ below avg" : "↑ above avg"}
            </span>
          ) : "Amazon"}
        />
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

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: ReactNode; accent?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className="truncate text-sm font-bold" style={{ color: accent ?? "#e8edf4" }}>{value}</div>
      {sub && <div className="truncate text-[9px] text-text-faint">{sub}</div>}
    </div>
  );
}
