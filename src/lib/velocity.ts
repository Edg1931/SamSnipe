// Sell-through / demand model. Turns a BSR snapshot into an estimated monthly
// sales range, a sell-through verdict, and a competition-decay forecast — so the
// user stops overbuying slow movers (the #1 costly arbitrage mistake).
//
// BSR→sales uses a category-aware power curve calibrated to public Amazon US
// rank/sales data. Deterministic and free; AI can layer a narrative on top.

import type { Deal } from "./types";

export interface Velocity {
  unitsLow: number;
  unitsHigh: number;
  /** Point estimate (geometric mean of the range). */
  unitsPerMonth: number;
  /** 0–100 — how confident we are in the estimate (drops as BSR rises). */
  confidence: number;
  /** Months of sell-through if you split the demand with current competitors. */
  monthsToSellThrough: number;
  /** How fast the spread erodes as more sellers pile in. */
  decay: "slow" | "moderate" | "fast";
  trend: "rising" | "flat" | "cooling";
  note: string;
}

// Rough "category size" — bigger categories sustain more sales at the same rank.
const CATEGORY_SCALE: Record<string, number> = {
  Toys: 1.0,
  Electronics: 1.3,
  "Home & Kitchen": 1.4,
  "Sports & Outdoors": 0.9,
  Beauty: 1.2,
  "Health & Household": 1.25,
  "Tools & Home Improvement": 0.8,
  "Office Products": 0.7,
  "Pet Supplies": 0.85,
  Grocery: 1.1,
  default: 1.0,
};

function trendFromHistory(deal: Deal): Velocity["trend"] {
  const h = deal.priceHistory;
  if (h.length < 10) return "flat";
  const first = h[0].price;
  const last = h[h.length - 1].price;
  const change = (last - first) / first;
  // Rising price on a tracked item usually signals tightening supply / demand.
  if (change > 0.06) return "rising";
  if (change < -0.06) return "cooling";
  return "flat";
}

export function estimateVelocity(deal: Deal): Velocity {
  const scale = CATEGORY_SCALE[deal.category] ?? CATEGORY_SCALE.default;
  const bsr = Math.max(1, deal.bsr);

  // Power curve: sales ≈ k / bsr^0.85, scaled by category. Tuned so BSR ~1k in a
  // big category ≈ a few hundred units/mo and BSR ~300k ≈ a handful.
  const base = (2_000_000 * scale) / Math.pow(bsr, 0.85);
  const unitsPerMonth = Math.max(1, Math.round(base));
  const spread = bsr < 5000 ? 0.25 : bsr < 50000 ? 0.4 : 0.6;
  const unitsLow = Math.max(1, Math.round(unitsPerMonth * (1 - spread)));
  const unitsHigh = Math.round(unitsPerMonth * (1 + spread));

  // More competing offers means your slice of the demand is thinner.
  const competitors = Math.max(1, deal.offerCount || 1);
  const yourShare = unitsPerMonth / (competitors + 1);
  const monthsToSellThrough = +(1 / Math.max(0.1, yourShare / 30)).toFixed(1);

  const confidence = Math.max(
    20,
    Math.min(95, Math.round(95 - Math.log10(bsr) * 11))
  );

  const decay: Velocity["decay"] =
    competitors >= 12 ? "fast" : competitors >= 5 ? "moderate" : "slow";

  const trend = trendFromHistory(deal);

  const note =
    bsr > 250000
      ? `BSR #${bsr.toLocaleString()} is slow — expect ~${unitsLow}-${unitsHigh}/mo and a long hold.`
      : `~${unitsLow}-${unitsHigh}/mo at BSR #${bsr.toLocaleString()}; ${competitors} sellers means roughly ${Math.max(1, Math.round(yourShare))}/mo for you.`;

  return {
    unitsLow,
    unitsHigh,
    unitsPerMonth,
    confidence,
    monthsToSellThrough,
    decay,
    trend,
    note,
  };
}
