"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/types";
import { usd, compact, RISK_LABELS } from "@/lib/format";
import { calcProfit } from "@/lib/profit";
import { estimateVelocity } from "@/lib/velocity";
import { computeSurvival, SURVIVAL_COLOR } from "@/lib/survival";
import { computeSaturation, SATURATION_COLOR } from "@/lib/saturation";
import { computeUngating, type Approvals } from "@/lib/ungating";
import { channelOptions } from "@/lib/channels";
import type { RetailOffer } from "@/lib/retail";
import { resolveSourceUrl, amazonUrl, keepaUrl, amazonSearch, channelUrl } from "@/lib/links";
import { useEscape } from "@/lib/hooks";
import { assessTrust } from "@/lib/trust";
import { ConfidenceRing, VerdictBadge, RiskChip, SurvivalShield } from "./Badges";
import { Sparkline } from "./Sparkline";

interface AIVerdict {
  verdict: "BUY" | "WATCH" | "PASS";
  confidence: number;
  reason: string;
  risks: string[];
  keyFactors: string[];
  source: "ai" | "rules";
}

// Full-page deal workspace: identity + verdict in a sticky header, with the
// full breakdown (trust, survival, AI analysis, sell-through, price history,
// source options, profit calculator, exit channel, risks) spread across a
// multi-column grid, plus verify links and buy-list actions.
export function DealDetail({
  deal, inBuyList, exempted, approvals, onClose, onAddToBuyList, onPass, onExemptBrand,
}: {
  deal: Deal;
  inBuyList: boolean;
  exempted: boolean;
  approvals: Approvals;
  onClose: () => void;
  onAddToBuyList: (deal: Deal) => void;
  onPass: (deal: Deal) => void;
  onExemptBrand: (brand: string) => void;
}) {
  useEscape(onClose);
  const [cost, setCost] = useState(deal.sourcePrice);
  const [sell, setSell] = useState(deal.amazonPrice);
  const p = calcProfit({ cost, sellPrice: sell, category: deal.category });
  const v = estimateVelocity(deal);
  const survival = computeSurvival(deal);
  const saturation = computeSaturation(deal);
  const ungating = computeUngating(deal, approvals);
  const channels = channelOptions(deal);
  const best = channels[0];

  const [ai, setAi] = useState<AIVerdict | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  const [offers, setOffers] = useState<RetailOffer[] | null>(null);
  const [retailSrc, setRetailSrc] = useState<"live" | "mock" | null>(null);
  const [offersLoading, setOffersLoading] = useState(true);

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

  // Fetch real retailer prices (live SerpApi when configured, else modeled).
  useEffect(() => {
    let live = true;
    const id = setTimeout(() => {
      setOffersLoading(true);
      setOffers(null);
      fetch("/api/retail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: deal.title, brand: deal.brand, asin: deal.match.asin, reference: deal.amazonPrice }),
      })
        .then((r) => r.json())
        .then((d) => { if (live && !d.error) { setOffers(d.offers ?? []); setRetailSrc(d.source); } })
        .finally(() => { if (live) setOffersLoading(false); });
    }, 0);
    return () => { live = false; clearTimeout(id); };
  }, [deal]);

  const azUrl = amazonUrl(deal.match.asin) ?? amazonSearch(`${deal.brand} ${deal.title}`);
  const keUrl = keepaUrl(deal.match.asin);
  const srcUrl = resolveSourceUrl({ source: deal.source, title: deal.title, sourceUrl: deal.sourceUrl });
  const trust = assessTrust(deal);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* Sticky page header — identity, verdict, primary actions */}
      <header className="glass animate-rise sticky top-0 z-10 flex items-center gap-3 border-b border-border px-4 py-3 lg:px-6">
        <button onClick={onClose} title="Close (Esc)" aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        <a href={azUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Open on Amazon">
          {deal.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={deal.imageUrl} alt={deal.title} className="h-10 w-10 rounded-xl bg-white/5 object-contain p-1" />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-xl font-bold text-white/90" style={{ background: `linear-gradient(135deg, ${deal.imageColor}, ${deal.imageColor}99)` }}>
              {deal.brand.slice(0, 2)}
            </div>
          )}
        </a>
        <div className="min-w-0 flex-1">
          <a href={azUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold leading-tight text-text hover:text-accent">
            {deal.title}
          </a>
          <p className="truncate text-[11px] text-text-dim">
            <a href={amazonSearch(deal.brand)} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{deal.brand}</a>
            {" · "}{deal.category}
            {deal.rating ? <> · ★ {deal.rating}{deal.reviewCount ? ` (${deal.reviewCount.toLocaleString()})` : ""}</> : null}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <button onClick={() => onPass(deal)} className="rounded-xl border border-border bg-white/5 px-4 py-2 text-[12px] font-medium text-text-dim hover:bg-white/10">Pass</button>
          <button onClick={() => onAddToBuyList(deal)} disabled={inBuyList} className="rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-black hover:opacity-90 disabled:opacity-50">{inBuyList ? "✓ In buy list" : "Add to buy list"}</button>
        </div>
        <VerdictBadge verdict={deal.verdict} />
      </header>

      {/* Scrollable full-page body — insight spread across a multi-column grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-5 lg:px-6">
          <div className="columns-1 gap-4 md:columns-2 xl:columns-3">

        <div className="mb-4 flex break-inside-avoid items-center justify-between rounded-xl border border-border bg-black/20 p-3">
          <div className="flex items-center gap-3">
            <ConfidenceRing match={deal.match} size={52} />
            <div>
              <a href={azUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-accent hover:underline">
                {deal.match.asin} ↗
              </a>
              <div className="text-[11px] text-text-dim">via {deal.match.method.join(" + ")}</div>
            </div>
          </div>
        </div>

        {/* Data & trust */}
        <div className="mb-4 break-inside-avoid rounded-xl border p-3" style={{ borderColor: `${trust.color}40`, background: `${trust.color}0d` }}>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: trust.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: trust.color }} />
              {trust.label}
            </span>
            <span className="text-[10px] text-text-faint">fetched {trust.fetchedAgoMin < 1 ? "just now" : `${trust.fetchedAgoMin}m ago`}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-black/20 px-2.5 py-1.5">
              <div className="text-text-faint">Price as of</div>
              <div className={trust.stale ? "font-medium text-warn" : "font-medium text-text"}>
                {trust.pricedAt ?? "—"}{trust.priceAgeDays != null ? ` · ${trust.priceAgeDays}d old` : ""}{trust.stale ? " ⏱" : ""}
              </div>
            </div>
            <div className="rounded-lg bg-black/20 px-2.5 py-1.5">
              <div className="text-text-faint">Fees</div>
              <div className="font-medium" style={{ color: trust.feesSource === "keepa" ? "#10d98e" : "#f5a524" }}>
                {trust.feesSource === "keepa" ? "Amazon-actual (Keepa)" : "Estimated"}
              </div>
            </div>
          </div>
          <ul className="mt-2 space-y-0.5">
            {trust.notes.map((n, i) => <li key={i} className="text-[11px] leading-snug text-text-dim">• {n}</li>)}
          </ul>
          <div className="mt-2 flex gap-2 text-[11px]">
            <a href={azUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Verify on Amazon ↗</a>
            {keUrl && <a href={keUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Verify on Keepa ↗</a>}
          </div>
          <p className="mt-2 border-t border-border-soft pt-2 text-[11px] leading-relaxed text-text-dim">{deal.match.rationale}</p>
        </div>

        {/* Account-survival score */}
        <div
          className="mb-4 break-inside-avoid rounded-xl border p-3"
          style={{ borderColor: `${SURVIVAL_COLOR[survival.band]}40`, background: `${SURVIVAL_COLOR[survival.band]}0d` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: SURVIVAL_COLOR[survival.band] }}>
              <ShieldIcon /> Account-survival score
            </div>
            <SurvivalShield score={survival.score} band={survival.band} size="lg" showLabel />
          </div>
          <p className="mt-1.5 text-[12px] text-text">{survival.headline}</p>
          <ul className="mt-2 space-y-1">
            {survival.factors.filter((f) => f.impact < 0).map((f, i) => (
              <li key={i} className="flex items-start justify-between gap-2 text-[11px]">
                <span className="text-text-dim">• {f.detail}</span>
                <span className="shrink-0 font-mono text-[#f88aa1]">{f.impact}</span>
              </li>
            ))}
            {survival.factors.every((f) => f.impact >= 0) && (
              <li className="text-[11px] text-text-dim">• No account-safety red flags detected.</li>
            )}
          </ul>
          {survival.suggestExemptBrand && (
            <button
              onClick={() => onExemptBrand(survival.suggestExemptBrand!)}
              disabled={exempted}
              className="mt-2.5 w-full rounded-lg border border-danger/30 bg-danger/10 py-2 text-[12px] font-medium text-[#f88aa1] transition hover:bg-danger/15 disabled:opacity-50"
            >
              {exempted ? `✓ ${survival.suggestExemptBrand} exempted` : `Exempt ${survival.suggestExemptBrand} from future scans`}
            </button>
          )}
        </div>

        {/* Ungating status */}
        <div className="mb-4 flex break-inside-avoid items-start gap-2 rounded-xl border border-border bg-black/20 p-2.5">
          <span
            className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: ungating.status === "open" ? "#10d98e" : ungating.status === "approved" ? "#10d98e" : ungating.canUngate ? "#f5a524" : "#f4476b" }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-text">{ungating.label}</div>
            <p className="text-[11px] leading-snug text-text-dim">{ungating.note}</p>
          </div>
        </div>

        {/* AI analysis */}
        <div className="mb-4 break-inside-avoid rounded-xl border border-accent/20 bg-accent/5 p-3">
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
        <div className="mb-4 break-inside-avoid rounded-xl border border-border bg-black/20 p-3">
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
          <div className="mt-2 flex items-start gap-1.5 border-t border-border-soft pt-2">
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SATURATION_COLOR[saturation.level] }} />
            <p className="text-[11px] leading-snug text-text-dim">
              <span className="font-medium capitalize" style={{ color: SATURATION_COLOR[saturation.level] }}>{saturation.level}</span> · {saturation.note}
            </p>
          </div>
        </div>

        {/* Price history */}
        <div className="mb-4 break-inside-avoid rounded-xl border border-border bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-text-dim">
            {keUrl ? (
              <a href={keUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent">90-day price history · Keepa ↗</a>
            ) : (
              <span>90-day price history</span>
            )}
            <span>{deal.avg90 ? `avg ${usd(deal.avg90)} · ` : ""}{deal.offerCount} offers</span>
          </div>
          <div className="overflow-x-auto">
            <Sparkline data={deal.priceHistory} width={320} height={90} color={deal.imageColor} />
          </div>
        </div>

        {/* Source options (real retailer prices) */}
        <div className="mb-4 break-inside-avoid rounded-xl border border-border bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-wide text-text-dim">Source options</span>
            {retailSrc && (
              <span className="flex items-center gap-1.5 text-text-faint">
                <span className={`h-1.5 w-1.5 rounded-full ${retailSrc === "live" ? "bg-accent" : "bg-warn"}`} />
                {retailSrc === "live" ? "live retailer prices" : "modeled prices"}
              </span>
            )}
          </div>
          {offersLoading ? (
            <div className="flex items-center gap-2 py-1 text-[12px] text-text-dim"><Spinner /> Checking retailers…</div>
          ) : offers && offers.length > 0 ? (
            <div className="space-y-1">
              {offers.map((o) => {
                const op = calcProfit({ cost: o.price, sellPrice: sell, category: deal.category });
                const active = Math.abs(cost - o.price) < 0.005;
                return (
                  <div
                    key={o.retailer}
                    onClick={() => setCost(o.price)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] ${active ? "bg-accent/10 ring-1 ring-accent/40" : "bg-black/20 hover:bg-white/5"}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={active ? "font-semibold text-text" : "text-text-dim"}>{o.retailer}</span>
                      {o.clearance && <span className="rounded bg-accent/15 px-1 text-[9px] font-medium text-accent">clearance</span>}
                      {!o.inStock && <span className="rounded bg-danger/15 px-1 text-[9px] font-medium text-[#f88aa1]">out of stock</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium text-text">{usd(o.price)}</span>
                      <span className="w-12 text-right font-mono" style={{ color: op.roi >= 30 ? "#10d98e" : op.roi >= 15 ? "#f5a524" : "#f4476b" }}>{op.roi}%</span>
                      <a href={o.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent" title={`Verify this price on ${o.retailer}`}>↗</a>
                    </span>
                  </div>
                );
              })}
              <p className="pt-1 text-[10px] text-text-faint">Tap a row to price the calculator against that source · ↗ opens the retailer to verify the price.</p>
              {retailSrc === "mock" && (
                <p className="text-[10px] leading-snug text-warn/90">
                  Estimated prices (modeled from the Amazon price), so links go to a search to find the item. Enable a live retailer feed (SerpApi) for exact prices and direct product links.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-text-dim">No retailer matches found — verify the item manually.</p>
          )}
        </div>

        {/* Live profit calculator */}
        <div className="mb-4 break-inside-avoid rounded-xl border border-border bg-black/20 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Profit calculator</div>
          <p className="mb-3 mt-0.5 text-[10px] text-text-faint">
            {trust.feesSource === "keepa"
              ? "This deal's fees are Amazon-actual (Keepa). What-if recalcs below use category-rate estimates."
              : "Fees estimated from category rates — connect Keepa for Amazon-actual fees."}
          </p>
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

        {/* Multi-channel exits */}
        <div className="mb-4 break-inside-avoid rounded-xl border border-border bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-wide text-text-dim">Best exit channel</span>
            <span className="text-text-dim">winner: <span className="font-semibold text-accent">{best.channel}</span></span>
          </div>
          <div className="space-y-1">
            {channels.map((ch, i) => (
              <div
                key={ch.channel}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] ${i === 0 ? "bg-accent/10" : "bg-black/20"}`}
              >
                <span className={i === 0 ? "font-semibold text-text" : "text-text-dim"}>{ch.channel}</span>
                <span className="flex items-center gap-3">
                  <span className="text-text-dim">{usd(ch.estPrice)}</span>
                  <span className="font-mono" style={{ color: ch.netProfit > 0 ? "#10d98e" : "#f4476b" }}>{usd(ch.netProfit)}</span>
                  <span className="w-12 text-right font-mono text-text-dim">{ch.roi}%</span>
                  <a
                    href={channelUrl(ch.channel, { asin: deal.match.asin, title: deal.title, brand: deal.brand })}
                    target="_blank" rel="noopener noreferrer"
                    className="text-accent"
                    title={ch.channel === "eBay" ? `Verify on ${ch.channel} (sold comps)` : `Verify price on ${ch.channel}`}
                  >↗</a>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-text-dim">{best.note}</p>
          <p className="mt-1 text-[10px] text-text-faint">↗ opens that marketplace to verify the sell price — eBay shows sold/completed listings (real comps).</p>
        </div>

        {/* Risks */}
        {deal.risks.length > 0 && (
          <div className="mb-4 break-inside-avoid rounded-xl border border-border bg-black/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-dim">Risk radar</div>
            <div className="flex flex-wrap gap-1.5">
              {deal.risks.map((r) => <RiskChip key={r} risk={r} />)}
            </div>
            <ul className="mt-2 space-y-1 text-[11px] text-text-dim">
              {deal.risks.map((r) => <li key={r}>• {RISK_LABELS[r]} — flagged before purchase.</li>)}
            </ul>
          </div>
        )}

          </div>{/* end columns grid */}

          {/* Verify links — full width */}
          <div className={`mt-2 grid grid-cols-1 gap-2 ${keUrl ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <a href={srcUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border bg-white/5 py-2.5 text-center text-[12px] font-medium text-text hover:bg-white/10">
              {deal.source} ↗
            </a>
            <a href={azUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border bg-white/5 py-2.5 text-center text-[12px] font-medium text-text hover:bg-white/10">
              Amazon ↗
            </a>
            {keUrl && (
              <a href={keUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border bg-white/5 py-2.5 text-center text-[12px] font-medium text-text hover:bg-white/10">
                Keepa ↗
              </a>
            )}
          </div>

          {/* Buy-list actions — mobile (the sticky header carries them on sm+) */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
            <button onClick={() => onPass(deal)} className="rounded-xl border border-border bg-white/5 py-2.5 text-center text-[12px] font-medium text-text-dim hover:bg-white/10">
              Pass
            </button>
            <button onClick={() => onAddToBuyList(deal)} disabled={inBuyList} className="rounded-xl bg-accent py-2.5 text-center text-[12px] font-semibold text-black hover:opacity-90 disabled:opacity-50">
              {inBuyList ? "✓ In buy list" : "Add to buy list"}
            </button>
          </div>
          <div className="h-6" />
        </div>
      </div>
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

function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3z" />
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
