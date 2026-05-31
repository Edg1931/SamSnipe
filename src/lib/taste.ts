// #5 Personalized ranker — learns your taste from Buy/Pass decisions and scores
// how well each deal fits, powering a "For You" sort. The more you use it, the
// sharper it gets: a moat static filters can't copy.

import type { Deal } from "./types";
import { computeSurvival } from "./survival";

export interface Decision {
  action: "buy" | "pass";
  title: string;
  category: string;
  brand: string;
  roi: number;
  sourcePrice: number;
  survival: number;
  ts: string;
}

export interface TasteProfile {
  hasData: boolean;
  categoryWeights: Record<string, number>; // net buy signal per category
  roiThreshold: number; // avg ROI of buys
  priceLow: number;
  priceHigh: number;
  minSurvival: number;
  buys: number;
  passes: number;
}

const KEY = "samsnipe.decisions.v1";

export function loadDecisions(): Decision[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Decision[]) : [];
  } catch {
    return [];
  }
}

export function saveDecisions(d: Decision[]) {
  try { localStorage.setItem(KEY, JSON.stringify(d.slice(-200))); } catch {}
}

export function recordDecision(
  list: Decision[],
  deal: Deal,
  action: "buy" | "pass"
): Decision[] {
  return [
    ...list,
    {
      action,
      title: deal.title,
      category: deal.category,
      brand: deal.brand,
      roi: deal.roi,
      sourcePrice: deal.sourcePrice,
      survival: computeSurvival(deal).score,
      ts: new Date().toISOString(),
    },
  ];
}

export function buildProfile(decisions: Decision[]): TasteProfile {
  const buys = decisions.filter((d) => d.action === "buy");
  const passes = decisions.filter((d) => d.action === "pass");
  if (buys.length === 0) {
    return {
      hasData: false,
      categoryWeights: {},
      roiThreshold: 30,
      priceLow: 0,
      priceHigh: Infinity,
      minSurvival: 50,
      buys: 0,
      passes: passes.length,
    };
  }
  const categoryWeights: Record<string, number> = {};
  for (const d of buys) categoryWeights[d.category] = (categoryWeights[d.category] ?? 0) + 1;
  for (const d of passes) categoryWeights[d.category] = (categoryWeights[d.category] ?? 0) - 0.5;

  const prices = buys.map((b) => b.sourcePrice).sort((a, b) => a - b);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

  return {
    hasData: true,
    categoryWeights,
    roiThreshold: Math.max(15, Math.round(avg(buys.map((b) => b.roi)) * 0.8)),
    priceLow: prices[0] * 0.6,
    priceHigh: prices[prices.length - 1] * 1.5,
    minSurvival: Math.max(40, Math.min(...buys.map((b) => b.survival)) - 10),
    buys: buys.length,
    passes: passes.length,
  };
}

// 0–100 fit score for ranking the "For You" feed.
export function scoreFit(deal: Deal, p: TasteProfile): number {
  if (!p.hasData) return 50;
  let s = 50;
  const cw = p.categoryWeights[deal.category] ?? 0;
  s += Math.max(-20, Math.min(25, cw * 8)); // category affinity
  if (deal.roi >= p.roiThreshold) s += 15; else s -= 10;
  if (deal.sourcePrice >= p.priceLow && deal.sourcePrice <= p.priceHigh) s += 10; else s -= 8;
  const surv = computeSurvival(deal).score;
  if (surv >= p.minSurvival) s += 10; else s -= 15;
  return Math.max(0, Math.min(100, Math.round(s)));
}
