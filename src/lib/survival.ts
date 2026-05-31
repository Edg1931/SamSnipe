// Account-survival score — the thing SellerAmp/Tactical Arbitrage don't lead
// with. Separate from profit: "will buying this keep my Amazon account alive?"
// Driven by ASIN-match trust, IP-complaint risk, gating, hazmat, pack-size
// mismatches, and a community-style brand-risk list. Outputs a 0–100 score and
// an explainable factor breakdown, and can recommend a brand exemption.

import type { Deal } from "./types";
import { estimateVelocity } from "./velocity";

// Brands that frequently file IP complaints / gate third-party resellers on
// Amazon US. Extensible — in production this is a living, crowd-fed list.
export const IP_RISK_BRANDS = new Set(
  [
    "nike", "adidas", "sony", "apple", "disney", "funko", "lego", "dyson",
    "bose", "samsung", "olaplex", "dewalt", "milwaukee", "stanley", "yeti",
    "nintendo", "lululemon", "the north face", "columbia", "ugg", "crocs",
    "pokemon", "marvel", "hasbro", "calvin klein", "ralph lauren",
  ].map((b) => b.toLowerCase())
);

// Categories Amazon commonly gates or that carry compliance overhead.
const GATED_CATEGORIES = new Set([
  "Beauty", "Health & Household", "Grocery", "Toys", // Toys gates seasonally
]);

export type SurvivalBand = "safe" | "caution" | "risky";

export interface SurvivalFactor {
  label: string;
  impact: number; // negative = lowers the score
  detail: string;
}

export interface Survival {
  score: number; // 0–100, higher = safer
  band: SurvivalBand;
  factors: SurvivalFactor[];
  /** Brand worth adding to the exemption list, if any. */
  suggestExemptBrand?: string;
  headline: string;
}

export function bandFor(score: number): SurvivalBand {
  if (score >= 75) return "safe";
  if (score >= 50) return "caution";
  return "risky";
}

export function isIpRiskBrand(brand: string): boolean {
  return IP_RISK_BRANDS.has(brand.trim().toLowerCase());
}

export function computeSurvival(deal: Deal): Survival {
  const factors: SurvivalFactor[] = [];
  let score = 100;
  const add = (label: string, impact: number, detail: string) => {
    score += impact;
    factors.push({ label, impact, detail });
  };

  // 1. ASIN-match trust — the foundation. A wrong ASIN can mean an inauthentic
  // claim against you, which is account-ending.
  const conf = deal.match.confidence;
  if (conf < 70) add("Low ASIN-match trust", -34, `Only ${conf}% match confidence — high chance of listing the wrong item.`);
  else if (conf < 85) add("Unverified ASIN match", -15, `${conf}% match confidence — confirm the exact item before buying.`);
  else add("Trusted ASIN match", 0, `${conf}% match confidence.`);

  // 2. IP complaint risk.
  const ipFlagged = deal.risks.includes("IP_COMPLAINT_RISK");
  const brandRisky = isIpRiskBrand(deal.brand);
  if (ipFlagged || brandRisky) {
    add("IP-complaint risk", -26, `${deal.brand} is a brand that frequently files IP complaints or gates resellers.`);
  }

  // 3. Gating.
  if (deal.risks.includes("GATED_CATEGORY") || GATED_CATEGORIES.has(deal.category)) {
    add("Likely gated", -18, `${deal.category} is commonly gated — you may need approval + invoices to sell.`);
  }

  // 4. Pack-size / variation mismatch.
  if (deal.risks.includes("VARIATION_MISMATCH") || deal.match.packSizeWarning) {
    add("Pack-size mismatch", -20, "Source pack size may differ from the ASIN — a classic inauthentic trigger.");
  }

  // 5. Hazmat / meltable handling.
  if (deal.risks.includes("HAZMAT")) add("Hazmat", -10, "Requires hazmat review and adds FBA restrictions.");
  if (deal.risks.includes("MELTABLE")) add("Meltable", -7, "Seasonal FBA restrictions and damage/return risk.");

  // 6. Thin demand raises hold time → ages inventory and return exposure.
  const v = estimateVelocity(deal);
  if (deal.risks.includes("LOW_SELL_THROUGH") || v.unitsPerMonth < 8) {
    add("Thin demand", -8, `~${v.unitsLow}-${v.unitsHigh}/mo — long holds increase storage fees and return exposure.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band = bandFor(score);

  const suggestExemptBrand = band === "risky" && brandRisky ? deal.brand : undefined;

  const headline =
    band === "safe"
      ? "Low account risk — clean to source."
      : band === "caution"
        ? "Some account risk — mitigate before buying at volume."
        : "High account risk — only proceed with eyes open (and invoices).";

  return { score, band, factors, suggestExemptBrand, headline };
}

export const SURVIVAL_COLOR: Record<SurvivalBand, string> = {
  safe: "#10d98e",
  caution: "#f5a524",
  risky: "#f4476b",
};
