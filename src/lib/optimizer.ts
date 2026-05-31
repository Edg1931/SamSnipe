// #9 Capital-allocation optimizer — "here's the best $X you can spend today."
// Turns a deal list into a buy *plan*: a basket that maximizes total profit
// within your cash, with per-deal quantity capped by realistic monthly
// sell-through and an optional account-safety floor.

import type { Deal } from "./types";
import { estimateVelocity } from "./velocity";
import { computeSurvival } from "./survival";

export interface OptPick {
  deal: Deal;
  qty: number;
  spend: number;
  profit: number;
}

export interface OptResult {
  picks: OptPick[];
  spend: number;
  profit: number;
  roi: number;
  leftover: number;
  budget: number;
  units: number;
}

export interface OptOptions {
  budget: number;
  minSurvival?: number; // skip risky deals
  excludePass?: boolean; // skip PASS verdicts (default true)
  maxPerBrand?: number; // cap concentration in one brand
}

// Greedy by profit-per-dollar — strong, fast, and explainable. Quantity per
// deal is capped at ~one month of sell-through so you don't buy a year of stock.
export function optimizeBasket(deals: Deal[], opts: OptOptions): OptResult {
  const { budget } = opts;
  const minSurvival = opts.minSurvival ?? 0;
  const excludePass = opts.excludePass ?? true;
  const maxPerBrand = opts.maxPerBrand ?? Infinity;

  const candidates = deals
    .filter((d) => d.sourcePrice > 0 && d.profit > 0)
    .filter((d) => !(excludePass && d.verdict === "PASS"))
    .filter((d) => computeSurvival(d).score >= minSurvival)
    .map((d) => ({
      deal: d,
      density: d.profit / d.sourcePrice,
      maxQty: Math.max(1, Math.min(50, Math.floor(estimateVelocity(d).unitsPerMonth))),
    }))
    .sort((a, b) => b.density - a.density);

  let remaining = budget;
  const brandSpend: Record<string, number> = {};
  const picks: OptPick[] = [];

  for (const c of candidates) {
    if (remaining < c.deal.sourcePrice) continue;
    const brandCap = maxPerBrand - (brandSpend[c.deal.brand] ?? 0);
    if (brandCap <= 0) continue;
    const affordable = Math.floor(remaining / c.deal.sourcePrice);
    const byBrand = Math.floor(brandCap / c.deal.sourcePrice);
    const qty = Math.max(0, Math.min(c.maxQty, affordable, byBrand));
    if (qty <= 0) continue;
    const spend = +(qty * c.deal.sourcePrice).toFixed(2);
    const profit = +(qty * c.deal.profit).toFixed(2);
    picks.push({ deal: c.deal, qty, spend, profit });
    remaining = +(remaining - spend).toFixed(2);
    brandSpend[c.deal.brand] = (brandSpend[c.deal.brand] ?? 0) + spend;
  }

  const spend = +picks.reduce((a, p) => a + p.spend, 0).toFixed(2);
  const profit = +picks.reduce((a, p) => a + p.profit, 0).toFixed(2);
  const units = picks.reduce((a, p) => a + p.qty, 0);
  return {
    picks,
    spend,
    profit,
    roi: spend > 0 ? +((profit / spend) * 100).toFixed(1) : 0,
    leftover: +(budget - spend).toFixed(2),
    budget,
    units,
  };
}
