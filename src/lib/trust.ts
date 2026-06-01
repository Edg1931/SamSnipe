// Trust layer — tells the user how much to trust each deal's numbers before
// making a financial decision. Distinguishes Keepa-verified data from estimates
// and demo data, surfaces data freshness, and flags stale prices.

import type { Deal } from "./types";

export type TrustLevel = "verified" | "lead" | "estimated" | "demo";

export interface Trust {
  level: TrustLevel;
  label: string;
  color: string;
  /** ISO date of the most recent price point we have. */
  pricedAt: string | null;
  priceAgeDays: number | null;
  stale: boolean; // price older than a week
  feesSource: "keepa" | "spapi" | "estimated";
  fetchedAgoMin: number;
  notes: string[];
}

const COLOR: Record<TrustLevel, string> = {
  verified: "#10d98e",
  lead: "#f5a524",
  estimated: "#f5a524",
  demo: "#64748b",
};

const LABEL: Record<TrustLevel, string> = {
  verified: "Keepa-verified",
  lead: "AI lead — unverified",
  estimated: "Estimated",
  demo: "Demo data",
};

export interface VerifiedScore {
  count: number;
  total: number;
  color: string;
  items: { label: string; ok: boolean }[];
}

/** How many of a deal's key figures are backed by live data (price/cost/fees). */
export function verifiedScore(deal: Deal): VerifiedScore {
  const t = assessTrust(deal);
  const items = [
    { label: "Sell price", ok: t.level === "verified" },
    { label: "Buy cost", ok: deal.costSource === "live" },
    { label: "Fees", ok: deal.feesSource === "keepa" || deal.feesSource === "spapi" },
  ];
  const count = items.filter((i) => i.ok).length;
  const color = count === items.length ? "#10d98e" : count >= 1 ? "#f5a524" : "#64748b";
  return { count, total: items.length, color, items };
}

function daysBetween(iso: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 86400000));
}

export function assessTrust(deal: Deal, now = Date.now()): Trust {
  const last = deal.priceHistory[deal.priceHistory.length - 1];
  const pricedAt = last?.t ?? null;
  const priceAgeDays = pricedAt ? daysBetween(pricedAt, now) : null;
  const feesSource = deal.feesSource ?? "estimated";

  // Live Keepa deals carry a real ASIN (100% confidence) sourced from the web.
  const keepaVerified = deal.origin === "web" && deal.match.confidence >= 100;
  let level: TrustLevel;
  if (keepaVerified) level = "verified";
  else if (deal.origin === "web") level = "lead"; // AI-discovered, ASIN not yet verified
  else if (deal.origin === "import") level = deal.match.confidence >= 100 ? "verified" : "estimated";
  else level = "demo"; // mock scan engine

  const stale = priceAgeDays != null && priceAgeDays > 7;
  const fetchedAgoMin = Math.max(0, Math.round((now - new Date(deal.foundAt).getTime()) / 60000));

  const notes: string[] = [];
  if (level === "verified") notes.push("ASIN, price & BSR verified against Keepa (Amazon US).");
  if (level === "lead") notes.push("Found by AI web search — connect/repair Keepa to verify the ASIN & Amazon price.");
  if (level === "demo") notes.push("Illustrative demo data — connect Keepa for real numbers before buying.");
  const realFees = feesSource === "keepa" || feesSource === "spapi";
  notes.push(realFees ? `Fees are Amazon-actual (${feesSource === "spapi" ? "SP-API" : "Keepa"}).` : "Fees are estimated from category rates.");
  // Buy-side provenance: the sell price comes from Keepa, but the source/buy
  // price (and therefore ROI) is modeled unless it's a live retailer price or
  // your own imported cost.
  if (deal.costSource === "live") notes.push("Buy price is a live retailer price (SerpApi) — the source link goes to the actual listing.");
  else if (deal.costSource === "import" || deal.origin === "import") notes.push("Buy cost is from your imported file.");
  else notes.push("Buy price is an estimate (modeled from the Amazon price) — verify at the source before buying, or enable a live retailer feed.");
  if (stale) notes.push(`Latest price is ${priceAgeDays} days old — re-check before committing.`);

  return {
    level,
    label: LABEL[level],
    color: COLOR[level],
    pricedAt,
    priceAgeDays,
    stale,
    feesSource,
    fetchedAgoMin,
    notes,
  };
}
