// Mock sourcing engine. Generates realistic, internally-consistent deals so
// the dashboard is fully alive before Keepa/SP-API are wired in. Every deal's
// profit/ROI is run through the same calcProfit() used in production.

import { calcProfit } from "./profit";
import { decideVerdict } from "./verdict";
import { sourceSearchUrl } from "./links";
import type {
  Deal,
  RiskFlag,
  SourceSite,
  PricePoint,
  AsinMatch,
} from "./types";

// Deterministic PRNG so a given seed always yields the same deal set
// (stable demo + reproducible "scans").
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRODUCTS: {
  title: string;
  brand: string;
  category: string;
  weight: number;
  color: string;
}[] = [
  { title: "LEGO Technic Bugatti Chiron 42083", brand: "LEGO", category: "Toys", weight: 4.2, color: "#3b82f6" },
  { title: "Ninja Foodi 8-Qt Dual Zone Air Fryer", brand: "Ninja", category: "Home & Kitchen", weight: 12, color: "#ef4444" },
  { title: "Stanley Quencher H2.0 40oz Tumbler", brand: "Stanley", category: "Home & Kitchen", weight: 1.6, color: "#10b981" },
  { title: "Sony WH-1000XM5 Wireless Headphones", brand: "Sony", category: "Electronics", weight: 0.9, color: "#6366f1" },
  { title: "CeraVe Moisturizing Cream 19oz", brand: "CeraVe", category: "Beauty", weight: 1.4, color: "#f59e0b" },
  { title: "Funko Pop! Marvel Deadpool Deluxe", brand: "Funko", category: "Toys", weight: 0.5, color: "#ec4899" },
  { title: "Owala FreeSip 24oz Insulated Bottle", brand: "Owala", category: "Sports & Outdoors", weight: 0.8, color: "#14b8a6" },
  { title: "Crayola Inspiration Art Case 140ct", brand: "Crayola", category: "Toys", weight: 2.4, color: "#a855f7" },
  { title: "Hydro Flask 32oz Wide Mouth", brand: "Hydro Flask", category: "Sports & Outdoors", weight: 0.9, color: "#0ea5e9" },
  { title: "DeWalt 20V MAX Cordless Drill Kit", brand: "DeWalt", category: "Tools & Home Improvement", weight: 3.6, color: "#eab308" },
  { title: "Olaplex No.3 Hair Perfector 3.3oz", brand: "Olaplex", category: "Beauty", weight: 0.4, color: "#f43f5e" },
  { title: "Melissa & Doug Wooden Activity Table", brand: "Melissa & Doug", category: "Toys", weight: 8.5, color: "#22c55e" },
  { title: "Keurig K-Mini Single Serve Brewer", brand: "Keurig", category: "Home & Kitchen", weight: 4.6, color: "#8b5cf6" },
  { title: "Anker 737 Power Bank 24000mAh", brand: "Anker", category: "Electronics", weight: 1.3, color: "#64748b" },
  { title: "Squishmallows 16in Avocado Plush", brand: "Squishmallows", category: "Toys", weight: 1.1, color: "#84cc16" },
  { title: "Instant Pot Duo 6-Qt Pressure Cooker", brand: "Instant Pot", category: "Home & Kitchen", weight: 11.8, color: "#ef4444" },
  { title: "Bose QuietComfort Earbuds II", brand: "Bose", category: "Electronics", weight: 0.6, color: "#6366f1" },
  { title: "Barbie Dreamhouse 2024 Edition", brand: "Barbie", category: "Toys", weight: 14, color: "#ec4899" },
  { title: "Carhartt Acrylic Watch Hat Beanie", brand: "Carhartt", category: "Sports & Outdoors", weight: 0.3, color: "#a16207" },
  { title: "Revlon One-Step Volumizer Hair Dryer", brand: "Revlon", category: "Beauty", weight: 1.9, color: "#f43f5e" },
  { title: "Yeti Rambler 20oz Tumbler", brand: "Yeti", category: "Sports & Outdoors", weight: 0.8, color: "#0ea5e9" },
  { title: "Hot Wheels 20-Car Gift Pack", brand: "Hot Wheels", category: "Toys", weight: 1.5, color: "#f97316" },
  { title: "Logitech MX Master 3S Mouse", brand: "Logitech", category: "Electronics", weight: 0.5, color: "#64748b" },
  { title: "Bissell Little Green Portable Cleaner", brand: "Bissell", category: "Home & Kitchen", weight: 9.5, color: "#22c55e" },
  { title: "Nerf Elite 2.0 Commander Blaster", brand: "Nerf", category: "Toys", weight: 1.2, color: "#eab308" },
  { title: "Conair Foot Spa Bath Massager", brand: "Conair", category: "Health & Household", weight: 4.2, color: "#14b8a6" },
  { title: "Cosori Air Fryer 5.8-Qt", brand: "Cosori", category: "Home & Kitchen", weight: 11, color: "#8b5cf6" },
  { title: "Fjallraven Kanken Classic Backpack", brand: "Fjallraven", category: "Sports & Outdoors", weight: 1.1, color: "#0d9488" },
  { title: "L.O.L. Surprise! OMG Fashion Doll", brand: "L.O.L. Surprise", category: "Toys", weight: 0.9, color: "#d946ef" },
];

const SITES: SourceSite[] = [
  "Walmart", "Target", "Home Depot", "eBay", "Best Buy",
  "Kohl's", "Liquidation.com", "Facebook Marketplace", "Costco",
];

function makeAsin(rng: () => number): string {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789";
  let s = "B0";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}

function buildMatch(rng: () => number, asin: string, brand: string): AsinMatch {
  const r = rng();
  if (r > 0.55) {
    return {
      asin,
      confidence: 92 + Math.floor(rng() * 8),
      method: ["UPC_EAN", "TITLE_AI"],
      rationale: `Exact UPC match confirmed against Amazon catalog; title and ${brand} brand align.`,
    };
  }
  if (r > 0.25) {
    return {
      asin,
      confidence: 80 + Math.floor(rng() * 11),
      method: ["MODEL_NUMBER", "IMAGE_AI"],
      rationale: "Model number matched; product image is a 0.94 visual match to the ASIN.",
    };
  }
  return {
    asin,
    confidence: 58 + Math.floor(rng() * 18),
    method: ["TITLE_AI", "IMAGE_AI"],
    rationale: "No UPC on source listing. Matched by title + image only — verify pack size before buying.",
    packSizeWarning: rng() > 0.5,
  };
}

function priceHistory(rng: () => number, base: number): PricePoint[] {
  const pts: PricePoint[] = [];
  let p = base * (0.85 + rng() * 0.3);
  const now = Date.now();
  for (let i = 89; i >= 0; i--) {
    p += (rng() - 0.5) * base * 0.06;
    p = Math.max(base * 0.6, Math.min(base * 1.4, p));
    pts.push({
      t: new Date(now - i * 86400000).toISOString().slice(0, 10),
      price: +p.toFixed(2),
    });
  }
  return pts;
}

function pickRisks(rng: () => number, brand: string, bsr: number, match: AsinMatch): RiskFlag[] {
  const risks: RiskFlag[] = [];
  const gatedBrands = ["Sony", "DeWalt", "Olaplex", "Funko"];
  if (gatedBrands.includes(brand) && rng() > 0.4) risks.push("IP_COMPLAINT_RISK");
  if (["Beauty", "Health & Household", "Grocery"].includes(brand) && rng() > 0.7) risks.push("GATED_CATEGORY");
  if (bsr > 250000) risks.push("LOW_SELL_THROUGH");
  if (match.packSizeWarning) risks.push("VARIATION_MISMATCH");
  if (rng() > 0.85) risks.push("MELTABLE");
  return risks;
}

// Optional targeting: restrict the scan to specific sites and/or AI web search.
export interface ScanTargets {
  /** Site names/domains the user explicitly added (e.g. "walmart.com"). */
  sites?: string[];
  /** Whether the open-web AI search contributes finds. */
  aiSearch?: boolean;
}

export function generateDeals(seed = 7, count = 14, targets?: ScanTargets): Deal[] {
  const rng = mulberry32(seed);
  // Build the pool of sources this scan is allowed to surface from.
  const pool: string[] = [];
  if (targets?.sites?.length) pool.push(...targets.sites);
  if (targets?.aiSearch) pool.push("AI Web Search");
  if (pool.length === 0) pool.push(...SITES); // default: scan everything

  // Shuffle product indices so each generated deal is a distinct product
  // (no duplicate cards) up to the catalog size.
  const order = PRODUCTS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const deals: Deal[] = [];
  for (let i = 0; i < count; i++) {
    const prod = PRODUCTS[order[i % PRODUCTS.length]];
    const amazonPrice = +(12 + rng() * 180).toFixed(2);
    const discount = 0.45 + rng() * 0.4; // source is 45–85% of Amazon price
    const sourcePrice = +(amazonPrice * discount).toFixed(2);
    const asin = makeAsin(rng);
    const match = buildMatch(rng, asin, prod.brand);
    const bsr = Math.floor(500 + rng() * rng() * 400000);
    const { profit, roi, margin, totalFees } = calcProfit({
      cost: sourcePrice,
      sellPrice: amazonPrice,
      category: prod.category,
      weightLb: prod.weight,
    });
    const risks = pickRisks(rng, prod.brand, bsr, match);
    const { verdict, reason } = decideVerdict(roi, match.confidence, risks);
    const site = pool[Math.floor(rng() * pool.length)];
    deals.push({
      id: `deal_${seed}_${i}`,
      title: prod.title,
      brand: prod.brand,
      category: prod.category,
      imageColor: prod.color,
      match,
      source: site,
      origin: site === "AI Web Search" ? "web" : "scan",
      sourceUrl: sourceSearchUrl(site, prod.title),
      sourcePrice,
      amazonPrice,
      // 90-day avg drifts around the current price so the entry-quality (below/
      // above average) signal is demonstrable in demo too.
      avg90: +(amazonPrice * (0.9 + rng() * 0.2)).toFixed(2),
      bsr,
      bsrCategory: prod.category,
      monthlySales: Math.max(1, Math.floor(40000 / Math.sqrt(bsr + 50))),
      offerCount: 1 + Math.floor(rng() * 22),
      profit,
      roi,
      margin,
      fbaFees: totalFees,
      feesSource: "estimated",
      verdict,
      verdictReason: reason,
      risks,
      priceHistory: priceHistory(rng, amazonPrice),
      foundAt: new Date(Date.now() - Math.floor(rng() * 6 * 3600000)).toISOString(),
    });
  }
  // Best deals first.
  return deals.sort((a, b) => b.roi - a.roi);
}
