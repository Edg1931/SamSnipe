// #7 Liquidation manifest AI. Drop in a pallet/manifest spreadsheet and every
// line is ASIN-matched (via the existing importer) and the WHOLE pallet is
// scored: total cost, projected resale, profit, ROI, how many lines are
// profitable, and the max you should bid to still hit a target return.

import type { Deal } from "./types";

export interface ManifestLine {
  deal: Deal;
  qty: number;
}

export type PalletVerdict = "BUY" | "WATCH" | "PASS";

export interface ManifestAnalysis {
  units: number;
  lines: number;
  profitableLines: number;
  cost: number; // total source cost across the pallet
  revenue: number; // projected gross resale
  fees: number;
  profit: number;
  roi: number;
  /** Max total bid for the pallet to still clear a 30% ROI target. */
  maxBid: number;
  verdict: PalletVerdict;
  note: string;
}

const TARGET_ROI = 0.3;

export function analyzeManifest(lines: ManifestLine[]): ManifestAnalysis {
  let units = 0, cost = 0, revenue = 0, fees = 0, profit = 0, profitableLines = 0;
  for (const { deal, qty } of lines) {
    const q = Math.max(1, qty);
    units += q;
    cost += deal.sourcePrice * q;
    revenue += deal.amazonPrice * q;
    fees += deal.fbaFees * q;
    profit += deal.profit * q;
    if (deal.profit > 0) profitableLines += 1;
  }
  const roi = cost > 0 ? +((profit / cost) * 100).toFixed(1) : 0;
  // profit = revenue - fees - cost; for 30% ROI: cost = (revenue - fees)/1.3
  const maxBid = +((revenue - fees) / (1 + TARGET_ROI)).toFixed(2);

  const verdict: PalletVerdict = roi >= 30 ? "BUY" : roi >= 12 ? "WATCH" : "PASS";
  const profitablePct = lines.length ? Math.round((profitableLines / lines.length) * 100) : 0;
  const note =
    verdict === "BUY"
      ? `Strong pallet: ${roi}% ROI, ${profitablePct}% of lines profitable. Bid up to ${usd(maxBid)} and still clear 30%.`
      : verdict === "WATCH"
        ? `Borderline: ${roi}% ROI at the listed cost. Only worth it under ${usd(maxBid)} total.`
        : `Pass at this price — ${roi}% ROI and only ${profitablePct}% of lines profitable.`;

  return {
    units,
    lines: lines.length,
    profitableLines,
    cost: +cost.toFixed(2),
    revenue: +revenue.toFixed(2),
    fees: +fees.toFixed(2),
    profit: +profit.toFixed(2),
    roi,
    maxBid,
    verdict,
    note,
  };
}

function usd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
