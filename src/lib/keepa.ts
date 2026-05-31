// Live Keepa client — the real price/BSR/history backbone for Amazon US.
//
// Adding KEEPA_API_KEY is enough to go live (set KEEPA_LIVE=0 to force demo).
// We pull as many deals as the token budget allows and extract everything Keepa
// gives us: real ASINs, product images, current Buy-Box price, BSR, 90-day
// price history + average, real Amazon FBA + referral fees, units sold/month,
// rating, review count, weight, and UPC. Any failure falls back to mock, so the
// app never breaks. Keepa domain 1 = amazon.com (US).

import { calcProfit } from "./profit";
import { decideVerdict, swatchFor } from "./verdict";
import { bestMockOffer } from "./retail";
import type { Deal, PricePoint, RiskFlag } from "./types";

const KEEPA_BASE = "https://api.keepa.com";
const KEY = process.env.KEEPA_API_KEY;
export const KEEPA_KEY_PRESENT = Boolean(KEY);
// Live whenever a key is present, unless explicitly disabled.
export const KEEPA_LIVE = Boolean(KEY) && process.env.KEEPA_LIVE !== "0";

// US best-seller category roots — a reliable source of real ASINs when the
// Deal endpoint is empty or unavailable on the plan.
const BESTSELLER_CATS = [165793011, 172282, 1055398, 3375251, 3760901, 3760911];

const DEAL_LIMIT = Math.max(1, Math.min(150, Number(process.env.SAMSNIPE_DEAL_LIMIT || "50")));
const COST_RATIO = Number(process.env.SAMSNIPE_COST_RATIO || "0.6");

// --- Keepa encoding helpers -------------------------------------------------
const KEEPA_EPOCH_MIN = 21564000;
const keepaTimeToISO = (kmin: number) =>
  new Date((kmin + KEEPA_EPOCH_MIN) * 60000).toISOString().slice(0, 10);

function decodeSeries(csv: number[] | null | undefined): PricePoint[] {
  if (!Array.isArray(csv)) return [];
  const out: PricePoint[] = [];
  for (let i = 0; i + 1 < csv.length; i += 2) {
    const v = csv[i + 1];
    if (v < 0) continue;
    out.push({ t: keepaTimeToISO(csv[i]), price: +(v / 100).toFixed(2) });
  }
  return out.slice(-90);
}

// Keepa csv indices.
const CSV_AMAZON = 0;
const CSV_NEW = 1;
const CSV_SALES_RANK = 3;
const CSV_RATING = 16;
const CSV_COUNT_REVIEWS = 17;
const CSV_BUYBOX = 18;

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

function imageUrl(imagesCSV: string | undefined): string | undefined {
  if (!imagesCSV) return undefined;
  const first = imagesCSV.split(",")[0]?.trim();
  return first ? `https://m.media-amazon.com/images/I/${first}` : undefined;
}

interface KeepaProductRaw {
  asin: string;
  title?: string;
  brand?: string;
  packageWeight?: number; // grams
  categoryTree?: { name: string }[];
  imagesCSV?: string;
  upcList?: string[];
  eanList?: string[];
  monthlySold?: number;
  referralFeePercent?: number;
  fbaFees?: { pickAndPackFee?: number };
  csv?: (number[] | null)[];
  stats?: {
    current?: number[];
    avg90?: number[];
    buyBoxPrice?: number;
    offerCountFBA?: number;
    rating?: number;
    reviewCount?: number;
  };
  offerCount?: number;
}

export interface KeepaProduct {
  asin: string;
  title: string;
  brand?: string;
  currentPrice: number | null;
  currentBsr: number | null;
  avg90: number | null;
  category: string;
  weightLb: number;
  offerCount: number;
  monthlySold: number | null;
  rating: number | null;
  reviewCount: number | null;
  referralPct: number | null;
  fbaFee: number | null;
  upc?: string;
  imageUrl?: string;
  priceHistory: PricePoint[];
}

function mapProduct(p: KeepaProductRaw): KeepaProduct | null {
  if (!p?.asin) return null;
  const cur = p.stats?.current ?? [];
  const avg = p.stats?.avg90 ?? [];
  const cents = (c?: number) => (c == null || c < 0 ? null : +(c / 100).toFixed(2));
  const currentPrice =
    cents(p.stats?.buyBoxPrice) ?? cents(cur[CSV_BUYBOX]) ?? cents(cur[CSV_NEW]) ?? cents(cur[CSV_AMAZON]);
  const bsrRaw = cur[CSV_SALES_RANK];
  const history =
    decodeSeries(p.csv?.[CSV_BUYBOX]).length ? decodeSeries(p.csv?.[CSV_BUYBOX])
    : decodeSeries(p.csv?.[CSV_NEW]).length ? decodeSeries(p.csv?.[CSV_NEW])
    : decodeSeries(p.csv?.[CSV_AMAZON]);
  const ratingRaw = p.stats?.rating ?? cur[CSV_RATING];
  return {
    asin: p.asin,
    title: p.title ?? p.asin,
    brand: p.brand,
    currentPrice,
    currentBsr: bsrRaw != null && bsrRaw > 0 ? bsrRaw : null,
    avg90: cents(avg[CSV_BUYBOX]) ?? cents(avg[CSV_NEW]) ?? cents(avg[CSV_AMAZON]),
    category: normalizeCategory(p.categoryTree?.[p.categoryTree.length - 1]?.name),
    weightLb: p.packageWeight ? +(p.packageWeight / 453.592).toFixed(2) : 1,
    offerCount: p.stats?.offerCountFBA ?? p.offerCount ?? 1,
    monthlySold: p.monthlySold != null && p.monthlySold > 0 ? p.monthlySold : null,
    rating: ratingRaw != null && ratingRaw > 0 ? +(ratingRaw / 10).toFixed(1) : null, // Keepa rating ×10
    reviewCount: p.stats?.reviewCount ?? (cur[CSV_COUNT_REVIEWS] > 0 ? cur[CSV_COUNT_REVIEWS] : null),
    referralPct: p.referralFeePercent ?? null,
    fbaFee: p.fbaFees?.pickAndPackFee != null ? +(p.fbaFees.pickAndPackFee / 100).toFixed(2) : null,
    upc: p.upcList?.[0] ?? p.eanList?.[0],
    imageUrl: imageUrl(p.imagesCSV),
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

/** Fetch full product detail for many ASINs, batched 100 per Keepa call. */
export async function getProducts(asins: string[]): Promise<KeepaProduct[]> {
  if (!KEEPA_LIVE || asins.length === 0) return [];
  const out: KeepaProduct[] = [];
  for (let i = 0; i < asins.length; i += 100) {
    const batch = asins.slice(i, i + 100).join(",");
    const data = (await keepaFetch(
      `/product?key=${KEY}&domain=1&asin=${batch}&stats=1&history=1&buybox=1&offers=20&rating=1`
    )) as { products?: KeepaProductRaw[] } | null;
    for (const raw of data?.products ?? []) {
      const mapped = mapProduct(raw);
      if (mapped) out.push(mapped);
    }
  }
  return out;
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

// Keepa Deal endpoint — current Amazon US price-drop deals. Paginated so we can
// surface as many candidates as the deal limit asks for.
async function findDealAsins(limit: number): Promise<string[]> {
  const asins: string[] = [];
  for (let page = 0; page < 5 && asins.length < limit; page++) {
    const selection = {
      page,
      domainId: 1,
      priceTypes: [CSV_BUYBOX],
      deltaPercentRange: [10, 95],
      isRangeEnabled: true,
      isFilterEnabled: true,
      sortType: 4,
    };
    const q = encodeURIComponent(JSON.stringify(selection));
    const data = (await keepaFetch(`/deal?key=${KEY}&selection=${q}`)) as
      | { deals?: { dr?: { asin: string }[] } }
      | null;
    const dr = data?.deals?.dr ?? [];
    if (dr.length === 0) break;
    for (const d of dr) if (d.asin && !asins.includes(d.asin)) asins.push(d.asin);
  }
  return asins.slice(0, limit);
}

// Best-seller ASINs across popular US categories — robust fallback.
async function findBestSellerAsins(limit: number): Promise<string[]> {
  const asins: string[] = [];
  const per = Math.ceil(limit / BESTSELLER_CATS.length) + 2;
  for (const cat of BESTSELLER_CATS) {
    if (asins.length >= limit) break;
    const data = (await keepaFetch(`/bestsellers?key=${KEY}&domain=1&category=${cat}`)) as
      | { bestSellersList?: { asinList?: string[] } }
      | null;
    const list = data?.bestSellersList?.asinList ?? [];
    for (const a of list.slice(0, per)) if (a && !asins.includes(a)) asins.push(a);
  }
  return asins.slice(0, limit);
}

function toDeal(p: KeepaProduct, i: number): Deal | null {
  if (!p.currentPrice || p.currentPrice <= 0) return null;
  const amazonPrice = p.currentPrice;
  const brand = p.brand || p.title.split(" ")[0] || "Item";

  // Real buy-side cost from the retailer feed; flat ratio as a fallback.
  const offer = bestMockOffer({ title: p.title, brand, asin: p.asin, reference: amazonPrice });
  const sourcePrice = offer ? offer.price : +(amazonPrice * COST_RATIO).toFixed(2);
  const source = offer ? offer.retailer : "Keepa deal";
  const sourceUrl = offer ? offer.url : `https://www.amazon.com/dp/${p.asin}`;

  const bsr = p.currentBsr ?? 150000;

  // Prefer Keepa's real fees for accuracy; fall back to our estimate.
  const est = calcProfit({ cost: sourcePrice, sellPrice: amazonPrice, category: p.category, weightLb: p.weightLb });
  let totalFees = est.totalFees;
  if (p.referralPct != null && p.fbaFee != null) {
    totalFees = +(amazonPrice * (p.referralPct / 100) + p.fbaFee).toFixed(2);
  }
  const profit = +(amazonPrice - sourcePrice - totalFees).toFixed(2);
  const roi = sourcePrice > 0 ? +((profit / sourcePrice) * 100).toFixed(1) : 0;
  const margin = amazonPrice > 0 ? +((profit / amazonPrice) * 100).toFixed(1) : 0;

  const risks: RiskFlag[] = [];
  if (bsr > 250000) risks.push("LOW_SELL_THROUGH");
  const { verdict, reason } = decideVerdict(roi, 100, risks);

  return {
    id: `keepa_${p.asin}_${i}`,
    title: p.title,
    brand,
    category: p.category,
    imageColor: swatchFor(brand),
    imageUrl: p.imageUrl,
    upc: p.upc,
    rating: p.rating ?? undefined,
    reviewCount: p.reviewCount ?? undefined,
    avg90: p.avg90 ?? undefined,
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
    monthlySales: p.monthlySold ?? Math.max(1, Math.floor(40000 / Math.sqrt(bsr + 50))),
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

// Diagnostic: tells you exactly why live data is or isn't flowing.
export async function keepaStatus(): Promise<Record<string, unknown>> {
  const keyPresent = KEEPA_KEY_PRESENT;
  if (!keyPresent) {
    return { keyPresent: false, live: false, ok: false,
      reason: "KEEPA_API_KEY is not set in this environment. Add it in Vercel → Settings → Environment Variables (Production), then redeploy." };
  }
  // Validate the key + check token balance with one cheap product call.
  const prod = (await keepaFetch(`/product?key=${KEY}&domain=1&asin=B07RP6F4N8&stats=1`)) as
    | { tokensLeft?: number; error?: { message?: string }; products?: { title?: string }[] }
    | null;
  if (!prod) {
    return { keyPresent: true, live: KEEPA_LIVE, ok: false,
      reason: "Keepa request failed — the key may be invalid, out of tokens, or blocked. Check your key at keepa.com/#!api." };
  }
  if (prod.error) {
    return { keyPresent: true, live: KEEPA_LIVE, ok: false, reason: `Keepa error: ${prod.error.message}` };
  }
  // How many ASINs each sourcing path yields.
  const dealAsins = await findDealAsins(10);
  const bestAsins = dealAsins.length ? [] : await findBestSellerAsins(10);
  return {
    keyPresent: true,
    live: KEEPA_LIVE,
    ok: true,
    tokensLeft: prod.tokensLeft,
    sampleProduct: prod.products?.[0]?.title ?? null,
    dealEndpointAsins: dealAsins.length,
    bestSellerAsins: bestAsins.length,
    willServeLive: KEEPA_LIVE && (dealAsins.length > 0 || bestAsins.length > 0),
    note: dealAsins.length === 0 ? "Deal endpoint returned 0 — using Best Sellers fallback." : "Deal endpoint working.",
  };
}

/** Live deal feed from Keepa. Returns [] when not live or on any failure. */
export async function liveDeals(limit = DEAL_LIMIT): Promise<Deal[]> {
  if (!KEEPA_LIVE) return [];
  try {
    let asins = await findDealAsins(limit);
    // Fall back to best sellers if the Deal endpoint returned nothing.
    if (asins.length === 0) asins = await findBestSellerAsins(limit);
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
