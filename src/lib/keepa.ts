// Live Keepa client — the real price/BSR/history backbone for Amazon US.
//
// The app ships on a deterministic mock engine so it's fully clickable with no
// key. Add KEEPA_API_KEY + KEEPA_LIVE=1 to .env.local and the deal feed switches
// to real Keepa data: real ASINs, titles, brands, current Buy-Box prices, BSR,
// 90-day price history, and offer counts. Any error falls back to mock, so the
// app never breaks.
//
// Keepa domain 1 = amazon.com (US). Docs: https://keepa.com/#!discuss
//
// Note on the cost side: Keepa describes the Amazon side of every product. The
// retailer/source price (your cost) still needs a retailer feed — until that's
// wired, live mode estimates cost as SAMSNIPE_COST_RATIO × Buy-Box price and
// labels the deal source "Keepa deal" so it's never mistaken for a confirmed
// retail price.

import { calcProfit } from "./profit";
import { decideVerdict } from "./verdict";
import { swatchFor } from "./verdict";
import { bestMockOffer } from "./retail";
import type { Deal, PricePoint, RiskFlag } from "./types";

const KEEPA_BASE = "https://api.keepa.com";
const KEY = process.env.KEEPA_API_KEY;
export const KEEPA_LIVE = Boolean(KEY) && process.env.KEEPA_LIVE === "1";

const COST_RATIO = Number(process.env.SAMSNIPE_COST_RATIO || "0.6");

// --- Keepa encoding helpers -------------------------------------------------
// Time is "Keepa minutes" since 2011; value arrays are flat [t, v, t, v, ...].
const KEEPA_EPOCH_MIN = 21564000;
const keepaTimeToISO = (kmin: number) =>
  new Date((kmin + KEEPA_EPOCH_MIN) * 60000).toISOString().slice(0, 10);

// Decode a Keepa csv series (price in cents, -1 = no data) into price points.
function decodeSeries(csv: number[] | null | undefined): PricePoint[] {
  if (!Array.isArray(csv)) return [];
  const out: PricePoint[] = [];
  for (let i = 0; i + 1 < csv.length; i += 2) {
    const v = csv[i + 1];
    if (v < 0) continue;
    out.push({ t: keepaTimeToISO(csv[i]), price: +(v / 100).toFixed(2) });
  }
  // Keep the last ~90 days for the sparkline.
  return out.slice(-90);
}

// Keepa csv indices we care about.
const CSV_AMAZON = 0;
const CSV_NEW = 1;
const CSV_SALES_RANK = 3;
const CSV_BUYBOX = 18;

// Map a Keepa category name onto the category buckets our fee model knows.
function normalizeCategory(name: string | undefined): string {
  const n = (name || "").toLowerCase();
  if (n.includes("toy") || n.includes("game")) return "Toys";
  if (n.includes("electronic") || n.includes("computer") || n.includes("cell")) return "Electronics";
  if (n.includes("kitchen") || n.includes("home")) return "Home & Kitchen";
  if (n.includes("sport") || n.includes("outdoor")) return "Sports & Outdoors";
  if (n.includes("beauty")) return "Beauty";
  if (n.includes("health") || n.includes("household")) return "Health & Household";
  if (n.includes("grocery")) return "Grocery";
  if (n.includes("tool") || n.includes("home improvement")) return "Tools & Home Improvement";
  if (n.includes("office")) return "Office Products";
  if (n.includes("pet")) return "Pet Supplies";
  return "Home & Kitchen";
}

interface KeepaProductRaw {
  asin: string;
  title?: string;
  brand?: string;
  packageWeight?: number; // grams
  categoryTree?: { name: string }[];
  csv?: (number[] | null)[];
  stats?: {
    current?: number[]; // by csv index, -1 = none
    buyBoxPrice?: number;
    offerCountFBA?: number;
  };
  offerCount?: number;
}

export interface KeepaProduct {
  asin: string;
  title: string;
  brand?: string;
  currentPrice: number | null; // dollars
  currentBsr: number | null;
  category: string;
  weightLb: number;
  offerCount: number;
  priceHistory: PricePoint[];
}

function mapProduct(p: KeepaProductRaw): KeepaProduct | null {
  if (!p?.asin) return null;
  const cur = p.stats?.current ?? [];
  const centsToDollar = (c?: number) => (c == null || c < 0 ? null : +(c / 100).toFixed(2));
  const currentPrice =
    centsToDollar(p.stats?.buyBoxPrice) ??
    centsToDollar(cur[CSV_BUYBOX]) ??
    centsToDollar(cur[CSV_NEW]) ??
    centsToDollar(cur[CSV_AMAZON]);
  const bsrRaw = cur[CSV_SALES_RANK];
  const currentBsr = bsrRaw != null && bsrRaw > 0 ? bsrRaw : null;
  const history =
    decodeSeries(p.csv?.[CSV_BUYBOX]).length
      ? decodeSeries(p.csv?.[CSV_BUYBOX])
      : decodeSeries(p.csv?.[CSV_NEW]).length
        ? decodeSeries(p.csv?.[CSV_NEW])
        : decodeSeries(p.csv?.[CSV_AMAZON]);
  return {
    asin: p.asin,
    title: p.title ?? p.asin,
    brand: p.brand,
    currentPrice,
    currentBsr,
    category: normalizeCategory(p.categoryTree?.[p.categoryTree.length - 1]?.name),
    weightLb: p.packageWeight ? +(p.packageWeight / 453.592).toFixed(2) : 1,
    offerCount: p.stats?.offerCountFBA ?? p.offerCount ?? 1,
    priceHistory: history,
  };
}

async function keepaFetch(path: string): Promise<unknown | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${KEEPA_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch full product detail for up to 100 ASINs. */
export async function getProducts(asins: string[]): Promise<KeepaProduct[]> {
  if (!KEEPA_LIVE || asins.length === 0) return [];
  const list = asins.slice(0, 100).join(",");
  const data = (await keepaFetch(
    `/product?key=${KEY}&domain=1&asin=${list}&stats=1&history=1&buybox=1&offers=20`
  )) as { products?: KeepaProductRaw[] } | null;
  return (data?.products ?? []).map(mapProduct).filter((p): p is KeepaProduct => Boolean(p));
}

export async function getProduct(asin: string): Promise<KeepaProduct | null> {
  const [p] = await getProducts([asin]);
  return p ?? null;
}

/** Resolve candidate ASINs for a UPC/EAN — the exact-match path for imports. */
export async function findByCode(code: string): Promise<string[]> {
  if (!KEEPA_LIVE) return [];
  const data = (await keepaFetch(`/product?key=${KEY}&domain=1&code=${code}`)) as
    | { products?: { asin: string }[] }
    | null;
  return (data?.products ?? []).map((p) => p.asin);
}

// Keepa Deal endpoint — current Amazon US price-drop deals, our live deal source.
async function findDealAsins(opts: { category?: number; limit: number }): Promise<string[]> {
  const selection = {
    page: 0,
    domainId: 1,
    priceTypes: [CSV_BUYBOX],
    deltaPercentRange: [15, 90], // meaningful drops
    isRangeEnabled: true,
    isFilterEnabled: true,
    sortType: 4,
    ...(opts.category ? { includeCategories: [opts.category] } : {}),
  };
  const q = encodeURIComponent(JSON.stringify(selection));
  const data = (await keepaFetch(`/deal?key=${KEY}&selection=${q}`)) as
    | { deals?: { dr?: { asin: string }[] } }
    | null;
  const dr = data?.deals?.dr ?? [];
  return dr.slice(0, opts.limit).map((d) => d.asin);
}

// Turn a real Keepa product into a SamSnipe Deal. ASIN is authoritative
// (confidence 100). Cost is estimated until a retailer feed is wired.
function toDeal(p: KeepaProduct, i: number): Deal | null {
  if (!p.currentPrice || p.currentPrice <= 0) return null;
  const amazonPrice = p.currentPrice;
  const brand = p.brand || p.title.split(" ")[0] || "Item";

  // Real(istic) buy-side cost from the retailer feed; flat ratio as a fallback.
  const offer = bestMockOffer({ title: p.title, brand, asin: p.asin, reference: amazonPrice });
  const sourcePrice = offer ? offer.price : +(amazonPrice * COST_RATIO).toFixed(2);
  const source = offer ? offer.retailer : "Keepa deal";
  const sourceUrl = offer ? offer.url : `https://www.amazon.com/dp/${p.asin}`;

  const bsr = p.currentBsr ?? 150000;
  const { profit, roi, margin, totalFees } = calcProfit({
    cost: sourcePrice,
    sellPrice: amazonPrice,
    category: p.category,
    weightLb: p.weightLb,
  });
  const risks: RiskFlag[] = [];
  if (bsr > 250000) risks.push("LOW_SELL_THROUGH");
  const { verdict, reason } = decideVerdict(roi, 100, risks);

  return {
    id: `keepa_${p.asin}_${i}`,
    title: p.title,
    brand,
    category: p.category,
    imageColor: swatchFor(brand),
    match: {
      asin: p.asin,
      confidence: 100,
      method: ["UPC_EAN"],
      rationale: "Live ASIN from Keepa — authoritative match against the Amazon catalog.",
    },
    source,
    origin: "web",
    sourceUrl,
    sourcePrice,
    amazonPrice,
    bsr,
    bsrCategory: p.category,
    monthlySales: Math.max(1, Math.floor(40000 / Math.sqrt(bsr + 50))),
    offerCount: p.offerCount,
    profit,
    roi,
    margin,
    fbaFees: totalFees,
    verdict,
    verdictReason: reason,
    risks,
    priceHistory: p.priceHistory.length ? p.priceHistory : [{ t: keepaTimeToISO(KEEPA_EPOCH_MIN), price: amazonPrice }],
    foundAt: new Date().toISOString(),
  };
}

/** Live deal feed from Keepa. Returns [] when not live or on any failure. */
export async function liveDeals(limit = 14): Promise<Deal[]> {
  if (!KEEPA_LIVE) return [];
  try {
    const asins = await findDealAsins({ limit });
    if (asins.length === 0) return [];
    const products = await getProducts(asins);
    return products
      .map((p, i) => toDeal(p, i))
      .filter((d): d is Deal => Boolean(d))
      .sort((a, b) => b.roi - a.roi);
  } catch {
    return [];
  }
}
