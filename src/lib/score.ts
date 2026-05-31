// Deal Score — one 0–100 number to rank deals by overall quality, not just ROI.
// Blends profitability (ROI), account safety (survival), and demand (velocity)
// so the best all-round flips float to the top of a big feed.

import type { Deal } from "./types";
import { computeSurvival } from "./survival";
import { estimateVelocity } from "./velocity";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export interface DealScore {
  score: number;
  band: "elite" | "strong" | "ok" | "weak";
  roiScore: number;
  safetyScore: number;
  demandScore: number;
}

export function dealScore(deal: Deal): DealScore {
  // 80% ROI maps to full marks; scales linearly below that.
  const roiScore = clamp((deal.roi / 80) * 100);
  const safetyScore = computeSurvival(deal).score;
  const v = estimateVelocity(deal);
  // ~300 units/mo is excellent; log scale rewards real movers.
  const demandScore = clamp((Math.log10(v.unitsPerMonth + 1) / Math.log10(300)) * 100) * (v.confidence / 100) + (1 - v.confidence / 100) * 50;

  const score = Math.round(0.45 * roiScore + 0.35 * safetyScore + 0.2 * clamp(demandScore));
  const band: DealScore["band"] = score >= 80 ? "elite" : score >= 60 ? "strong" : score >= 40 ? "ok" : "weak";
  return { score, band, roiScore: Math.round(roiScore), safetyScore, demandScore: Math.round(clamp(demandScore)) };
}

export const SCORE_COLOR: Record<DealScore["band"], string> = {
  elite: "#10d98e",
  strong: "#84cc16",
  ok: "#f5a524",
  weak: "#f4476b",
};
