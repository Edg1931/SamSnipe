// #8 Multi-channel exits. Amazon sourcing is getting harder and more gated, so
// don't only sell on Amazon — score each find for eBay, Walmart Marketplace,
// Mercari, and TikTok Shop too, and surface the best exit. When Amazon is
// gated, the agent routes you to the channel that isn't.

import type { Deal } from "./types";
import { calcProfit } from "./profit";

export type Channel = "Amazon" | "eBay" | "Walmart" | "Mercari" | "TikTok Shop";

export interface ChannelOption {
  channel: Channel;
  estPrice: number;
  feeRate: number;
  fees: number;
  netProfit: number;
  roi: number;
  note: string;
}

const COLLECTIBLE = ["Funko", "LEGO", "Pokemon", "Squishmallows"];
const TRENDY = ["Beauty", "Toys"];

export function channelOptions(deal: Deal): ChannelOption[] {
  const cost = deal.sourcePrice;
  const a = deal.amazonPrice;
  const isCollectible = COLLECTIBLE.some((b) => deal.brand.includes(b));
  const isTrendy = TRENDY.includes(deal.category);
  const opts: ChannelOption[] = [];

  // Amazon — reuse the FBA model we already compute.
  opts.push({
    channel: "Amazon",
    estPrice: a,
    feeRate: 0.15,
    fees: deal.fbaFees,
    netProfit: deal.profit,
    roi: deal.roi,
    note: "FBA — biggest audience, but referral + FBA fees and gating risk.",
  });

  // Generic marketplace model: price multiplier × fee rate, minus ship/handling.
  const mk = (channel: Channel, priceMult: number, feeRate: number, ship: number, note: string) => {
    const price = +(a * priceMult).toFixed(2);
    const fees = +(price * feeRate + ship).toFixed(2);
    const netProfit = +(price - cost - fees).toFixed(2);
    const roi = cost > 0 ? +((netProfit / cost) * 100).toFixed(1) : 0;
    opts.push({ channel, estPrice: price, feeRate, fees, netProfit, roi, note });
  };

  mk("eBay", isCollectible ? 1.12 : 0.96, 0.1335, 4.5,
    isCollectible ? "Collectors pay a premium here — often the best exit." : "No gating; you ship it yourself (~$4.50).");
  mk("Walmart", 0.98, 0.15, 0, "Growing marketplace, lighter competition, WFS available.");
  mk("Mercari", 0.9, 0.129, 4, "Fast for lower-priced items; you ship.");
  mk("TikTok Shop", isTrendy ? 1.02 : 0.92, 0.08, 4, isTrendy ? "Trend-friendly category — viral upside, low fees." : "Low fees but best for trend-driven items.");

  return opts.sort((x, y) => y.netProfit - x.netProfit);
}

export function bestChannel(deal: Deal): ChannelOption {
  return channelOptions(deal)[0];
}

// Re-export so callers can compute custom what-ifs if needed.
export { calcProfit };
