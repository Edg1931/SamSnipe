// Retailer price feed — the real cost side of arbitrage.
//
// Keepa tells us the Amazon (sell) side; this tells us what a product actually
// costs at retailers (the buy side), so the spread is genuine instead of a flat
// estimate. Pluggable providers:
//   • live  — SerpApi (Google Shopping + Walmart / Home Depot / eBay engines)
//             when SERPAPI_KEY + RETAIL_LIVE=1 are set. Real prices, retailers,
//             and direct product links for the actual item.
//   • mock  — deterministic, reference-based prices across retailers so the
//             feature works fully offline.
//
// Used two ways: cheaply at feed scale (mock reference pricing enriches each
// Keepa deal's cost) and on-demand in the deal drawer (real multi-retailer
// lookup via /api/retail).

import { sourceSearchUrl } from "./links";
import type { Deal } from "./types";

export type Retailer =
  | "Walmart" | "Target" | "Home Depot" | "Best Buy" | "Kohl's" | "eBay" | "Costco";

export interface RetailOffer {
  retailer: string;
  price: number;
  url: string;
  inStock: boolean;
  clearance: boolean;
  title?: string;
  provider: "live" | "mock";
}

export interface RetailQuery {
  title: string;
  brand?: string;
  asin?: string;
  /** Amazon sell price — lets the mock model produce realistic spreads. */
  reference?: number;
}

const SERP_KEY = process.env.SERPAPI_KEY;
export const retailLive = (): boolean => Boolean(SERP_KEY) && process.env.RETAIL_LIVE === "1";

// --- deterministic hash for stable mock pricing -----------------------------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// Typical "you can source it here for ~X% of the Amazon price" by retailer.
const RETAILER_FACTORS: { retailer: Retailer; base: number }[] = [
  { retailer: "Walmart", base: 0.62 },
  { retailer: "Target", base: 0.66 },
  { retailer: "Home Depot", base: 0.7 },
  { retailer: "Best Buy", base: 0.74 },
  { retailer: "Kohl's", base: 0.6 },
  { retailer: "eBay", base: 0.78 },
];

// Mock offers: realistic per-retailer prices, stock, and clearance flags.
export function mockOffers(q: RetailQuery): RetailOffer[] {
  const ref = q.reference && q.reference > 0 ? q.reference : 30;
  const offers: RetailOffer[] = [];
  for (const { retailer, base } of RETAILER_FACTORS) {
    const seed = hash(`${q.asin ?? q.title}|${retailer}`);
    const clearance = seed > 0.78;
    const factor = base + (seed - 0.5) * 0.18 - (clearance ? 0.18 : 0);
    const price = +(ref * Math.max(0.3, factor)).toFixed(2);
    const inStock = hash(`${retailer}|${q.title}|stock`) > 0.2;
    offers.push({
      retailer,
      price,
      url: sourceSearchUrl(retailer, q.title),
      inStock,
      clearance,
      provider: "mock",
    });
  }
  // Cheapest in-stock first.
  return offers.sort((a, b) =>
    a.inStock === b.inStock ? a.price - b.price : a.inStock ? -1 : 1
  );
}

// --- live provider: SerpApi -------------------------------------------------
interface SerpResult { price?: number; url?: string; title?: string; inStock?: boolean }

async function serpEngine(engine: string, retailer: string, q: RetailQuery): Promise<RetailOffer | null> {
  if (!SERP_KEY) return null;
  const query = encodeURIComponent(`${q.brand ?? ""} ${q.title}`.trim());
  const url = `https://serpapi.com/search.json?engine=${engine}&query=${query}&api_key=${SERP_KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const r = parseSerp(engine, data);
    if (!r || r.price == null) return null;
    return {
      retailer,
      price: +r.price.toFixed(2),
      url: r.url || sourceSearchUrl(retailer, q.title),
      inStock: r.inStock !== false,
      clearance: false,
      title: r.title,
      provider: "live",
    };
  } catch {
    return null;
  }
}

// Map each SerpApi engine's first organic result into a normalized offer.
function parseSerp(engine: string, data: Record<string, unknown>): SerpResult | null {
  if (engine === "walmart") {
    const first = (data.organic_results as Record<string, unknown>[] | undefined)?.[0];
    if (!first) return null;
    const offer = first.primary_offer as { offer_price?: number } | undefined;
    return { price: offer?.offer_price, url: first.product_page_url as string, title: first.title as string, inStock: !(first.out_of_stock as boolean) };
  }
  if (engine === "home_depot") {
    const first = (data.products as Record<string, unknown>[] | undefined)?.[0];
    if (!first) return null;
    return { price: first.price as number, url: first.link as string, title: first.title as string };
  }
  if (engine === "ebay") {
    const first = (data.organic_results as Record<string, unknown>[] | undefined)?.[0];
    if (!first) return null;
    const price = first.price as { extracted?: number } | number | undefined;
    return { price: typeof price === "object" ? price?.extracted : price, url: first.link as string, title: first.title as string };
  }
  return null;
}

function parsePrice(s?: string): number {
  if (!s) return 0;
  const m = s.replace(/,/g, "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

// Google Shopping aggregates real listings across many retailers, each with a
// price and a direct product link — the best single source for "what does this
// exact item actually cost, and where."
async function googleShoppingOffers(q: RetailQuery): Promise<RetailOffer[]> {
  if (!SERP_KEY) return [];
  const query = encodeURIComponent(`${q.brand ?? ""} ${q.title}`.trim());
  const url = `https://serpapi.com/search.json?engine=google_shopping&q=${query}&gl=us&hl=en&api_key=${SERP_KEY}`;
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { shopping_results?: Record<string, unknown>[] };
    const offers: RetailOffer[] = [];
    for (const r of (data.shopping_results ?? []).slice(0, 12)) {
      const price = typeof r.extracted_price === "number" ? r.extracted_price : parsePrice(r.price as string);
      const link = (r.link as string) || (r.product_link as string);
      if (!price || price <= 0 || !link) continue;
      offers.push({
        retailer: (r.source as string) || "Store",
        price: +price.toFixed(2),
        url: link,
        inStock: true,
        clearance: false,
        title: r.title as string,
        provider: "live",
      });
    }
    return offers;
  } catch {
    return [];
  }
}

async function liveOffers(q: RetailQuery): Promise<RetailOffer[]> {
  const engines: [string, string][] = [["walmart", "Walmart"], ["home_depot", "Home Depot"], ["ebay", "eBay"]];
  const [single, shopping] = await Promise.all([
    Promise.all(engines.map(([e, r]) => serpEngine(e, r, q))),
    googleShoppingOffers(q),
  ]);
  const all = [...single.filter((o): o is RetailOffer => Boolean(o)), ...shopping];
  // Dedupe by retailer, keeping the cheapest offer from each.
  const byRetailer = new Map<string, RetailOffer>();
  for (const o of all) {
    const key = o.retailer.toLowerCase();
    const cur = byRetailer.get(key);
    if (!cur || o.price < cur.price) byRetailer.set(key, o);
  }
  return [...byRetailer.values()].sort((a, b) => a.price - b.price);
}

// --- public API -------------------------------------------------------------

/** On-demand multi-retailer lookup: live when configured, else mock. */
export async function getRetailOffers(q: RetailQuery): Promise<{ offers: RetailOffer[]; source: "live" | "mock" }> {
  if (retailLive()) {
    const live = await liveOffers(q);
    if (live.length > 0) return { offers: live, source: "live" };
  }
  return { offers: mockOffers(q), source: "mock" };
}

/** Cheapest in-stock offer — used to enrich a deal's cost at feed scale. */
export function bestMockOffer(q: RetailQuery): RetailOffer | null {
  const inStock = mockOffers(q).filter((o) => o.inStock);
  return inStock[0] ?? null;
}

/** One lightweight live lookup (Google Shopping only = 1 SerpApi call). */
export async function bestLiveOffer(q: RetailQuery): Promise<RetailOffer | null> {
  if (!retailLive()) return null;
  const offers = await googleShoppingOffers(q);
  if (offers.length === 0) return null;
  return [...offers].sort((a, b) => a.price - b.price)[0];
}

/**
 * Replace the modeled cost with a REAL retailer price for the most promising
 * deals, so the headline ROI reflects what you can actually buy it for. Capped
 * to `limit` lookups (one SerpApi call each) to keep cost/latency sane; only
 * runs when SerpApi is live. Untouched deals keep their estimate.
 */
export async function applyLiveCosts(deals: Deal[], limit: number): Promise<Deal[]> {
  if (!retailLive() || deals.length === 0 || limit <= 0) return deals;
  // Spend lookups on the highest-ROI deals first.
  const targets = [...deals].sort((a, b) => b.roi - a.roi).slice(0, limit);
  const updates = new Map<string, Deal>();
  await Promise.all(
    targets.map(async (d) => {
      try {
        const best = await bestLiveOffer({ title: d.title, brand: d.brand, asin: d.match.asin, reference: d.amazonPrice });
        if (!best || best.price <= 0) return;
        const cost = best.price;
        const profit = +(d.amazonPrice - cost - d.fbaFees).toFixed(2);
        const roi = cost > 0 ? +((profit / cost) * 100).toFixed(1) : 0;
        const margin = d.amazonPrice > 0 ? +((profit / d.amazonPrice) * 100).toFixed(1) : 0;
        updates.set(d.id, {
          ...d, sourcePrice: cost, source: best.retailer, sourceUrl: best.url,
          profit, roi, margin, costSource: "live",
        });
      } catch {
        /* keep the original estimate on any failure */
      }
    })
  );
  return updates.size ? deals.map((d) => updates.get(d.id) ?? d) : deals;
}
