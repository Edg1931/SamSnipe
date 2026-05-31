// Keepa API client — the real price/BSR data backbone.
//
// The prototype ships with mock data so the whole app is clickable today.
// The moment you add KEEPA_API_KEY to .env.local, flip USE_LIVE to true
// (or set KEEPA_LIVE=1) and these functions hit the real Keepa endpoints.
//
// Docs: https://keepa.com/#!discuss/t/request-products/110
// Domain 1 = amazon.com (US).

const KEEPA_BASE = "https://api.keepa.com";
const KEY = process.env.KEEPA_API_KEY;
export const KEEPA_LIVE = Boolean(KEY) && process.env.KEEPA_LIVE === "1";

export interface KeepaProduct {
  asin: string;
  title: string;
  brand?: string;
  /** Keepa CSV[3] = sales rank history, CSV[0]/[1] = price history. */
  currentPrice: number | null;
  currentBsr: number | null;
  priceHistory: { t: string; price: number }[];
}

/** Look up an ASIN directly. Returns null on miss or when running mock. */
export async function getProduct(asin: string): Promise<KeepaProduct | null> {
  if (!KEEPA_LIVE) return null;
  const url = `${KEEPA_BASE}/product?key=${KEY}&domain=1&asin=${asin}&history=1`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const data = await res.json();
  return mapKeepa(data?.products?.[0]);
}

/** Find candidate ASINs for a UPC/EAN — the exact-match path. */
export async function findByCode(code: string): Promise<string[]> {
  if (!KEEPA_LIVE) return [];
  const url = `${KEEPA_BASE}/product?key=${KEY}&domain=1&code=${code}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.products ?? []).map((p: { asin: string }) => p.asin);
}

// Keepa encodes prices in cents and time in "Keepa minutes". This maps a
// raw product payload into our clean shape. Kept defensive on purpose.
function mapKeepa(p: unknown): KeepaProduct | null {
  if (!p || typeof p !== "object") return null;
  const prod = p as Record<string, unknown>;
  return {
    asin: String(prod.asin ?? ""),
    title: String(prod.title ?? ""),
    brand: prod.brand ? String(prod.brand) : undefined,
    currentPrice: null,
    currentBsr: null,
    priceHistory: [],
  };
}
