// Core domain types for SamSnipe — AI resale deal finder (Amazon US, FBA).

export type SourceSite =
  | "Walmart"
  | "Target"
  | "Home Depot"
  | "eBay"
  | "Best Buy"
  | "Kohl's"
  | "Liquidation.com"
  | "Facebook Marketplace"
  | "Costco";

export type RiskFlag =
  | "IP_COMPLAINT_RISK"
  | "GATED_CATEGORY"
  | "HAZMAT"
  | "MELTABLE"
  | "VARIATION_MISMATCH"
  | "LOW_SELL_THROUGH"
  | "BUYBOX_SUPPRESSED";

export type Verdict = "BUY" | "WATCH" | "PASS";

/** How a non-Amazon source listing was tied to an Amazon ASIN. */
export interface AsinMatch {
  asin: string;
  /** 0–100. Below ~80 we treat the match as needs-review. */
  confidence: number;
  /** What evidence produced the match, best-first. */
  method: ("UPC_EAN" | "MODEL_NUMBER" | "TITLE_AI" | "IMAGE_AI")[];
  /** Human-readable reason the AI is or isn't sure. */
  rationale: string;
  /** True when source pack size may differ from the ASIN (multipack trap). */
  packSizeWarning?: boolean;
}

export interface PricePoint {
  /** ISO date */
  t: string;
  price: number;
}

export interface Deal {
  id: string;
  title: string;
  brand: string;
  category: string;
  imageColor: string; // placeholder swatch until real images are wired
  match: AsinMatch;

  /** Where the agent found it: a default site, a custom domain, "AI Web Search", or "Imported". */
  source: string;
  /** How it entered the app — drives the little origin badge. */
  origin: "scan" | "import" | "web";
  sourceUrl: string;
  /** Real product image (Keepa) when available; else we render a swatch. */
  imageUrl?: string;
  upc?: string;
  rating?: number; // 0–5
  reviewCount?: number;
  avg90?: number; // 90-day average Amazon price
  sourcePrice: number; // your cost per unit
  amazonPrice: number; // current buy-box price

  bsr: number; // Best Sellers Rank in category
  bsrCategory: string;
  monthlySales: number; // estimated units/mo
  offerCount: number; // # of competing FBA/FBM offers

  profit: number; // net profit/unit after fees (computed)
  roi: number; // % (computed)
  margin: number; // % (computed)
  fbaFees: number;

  verdict: Verdict;
  /** AI-written one-liner explaining the verdict. */
  verdictReason: string;
  risks: RiskFlag[];

  priceHistory: PricePoint[];
  foundAt: string; // ISO timestamp the agent surfaced it
}

export interface ScanStatus {
  running: boolean;
  sitesScanned: number;
  totalSites: number;
  productsAnalyzed: number;
  dealsFound: number;
  lastRun: string;
}
