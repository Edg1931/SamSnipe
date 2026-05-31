// #6 Anti-saturation crowd radar. A network-effect signal: how many other
// SamSnipers are onto this deal. High interest = the price is about to get
// crushed as everyone piles in. (Simulated here from deal attributes; in
// production this is real, anonymized cross-user demand — a moat that grows
// with the user base.)

import type { Deal } from "./types";

export type SaturationLevel = "fresh" | "heating" | "saturated";

export interface Saturation {
  watchers: number; // users watching in last 7d
  buyers7d: number; // users who bought in last 7d
  level: SaturationLevel;
  note: string;
  simulated: true;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

export function computeSaturation(deal: Deal): Saturation {
  // The juicier the deal (high ROI, low BSR, high confidence), the more snipers
  // it attracts — and the faster its margin erodes.
  const heat = hash(deal.id);
  const attractiveness =
    Math.min(1, deal.roi / 80) * 0.5 +
    Math.min(1, 50000 / (deal.bsr + 5000)) * 0.3 +
    (deal.match.confidence / 100) * 0.2;
  const score = heat * 0.4 + attractiveness * 0.6;

  const watchers = Math.round(score * 240);
  const buyers7d = Math.round(score * watchers * 0.25);

  const level: SaturationLevel = score > 0.66 ? "saturated" : score > 0.4 ? "heating" : "fresh";
  const note =
    level === "saturated"
      ? `${watchers} snipers and ${buyers7d} buyers in 7d — expect the Buy Box price to drop. Move fast or skip.`
      : level === "heating"
        ? `${watchers} snipers watching — interest is building, source soon before it crowds.`
        : `Only ${watchers} snipers on this — relatively undiscovered, more room before saturation.`;

  return { watchers, buyers7d, level, note, simulated: true };
}

export const SATURATION_COLOR: Record<SaturationLevel, string> = {
  fresh: "#10d98e",
  heating: "#f5a524",
  saturated: "#f4476b",
};
