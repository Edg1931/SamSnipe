// Amazon Selling Partner API (SP-API) — real Amazon economics for a deal:
// exact FBA + referral fees, Buy Box / competition, and gating eligibility.
//
// Auth is token-only (LWA): exchange the refresh token for an access token and
// call SP-API with `x-amz-access-token` (no AWS SigV4 needed since 2023). Every
// call degrades to null on any failure or when unconfigured, so the app keeps
// working on estimates without it.

import type { Deal } from "./types";

const CLIENT_ID = process.env.SPAPI_CLIENT_ID;
const CLIENT_SECRET = process.env.SPAPI_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPAPI_REFRESH_TOKEN;
const MARKETPLACE_ID = process.env.SPAPI_MARKETPLACE_ID || "ATVPDKIKX0DER"; // Amazon US
const SELLER_ID = process.env.SPAPI_SELLER_ID; // merchant token, required for gating
const ENDPOINT = process.env.SPAPI_ENDPOINT || "https://sellingpartnerapi-na.amazon.com";

export const spApiEnabled = (): boolean => Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);

export interface SpFees { total: number; referral: number; fba: number; variableClosing?: number }
export interface SpBuyBox { buyBoxPrice: number | null; offerCount: number; fbaOffers: number }
export interface SpGating { gated: boolean; reasons: string[]; approvalUrl?: string }
export interface SpEconomics {
  fees: SpFees | null;
  buyBox: SpBuyBox | null;
  gating: SpGating | null;
}

// --- LWA access token (cached in-process until ~1 min before expiry) ---
let cached: { value: string; exp: number } | null = null;
async function accessToken(): Promise<string | null> {
  if (!spApiEnabled()) return null;
  if (cached && cached.exp > Date.now() + 60_000) return cached.value;
  try {
    const res = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: REFRESH_TOKEN!,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!d.access_token) return null;
    cached = { value: d.access_token, exp: Date.now() + (d.expires_in ?? 3600) * 1000 };
    return cached.value;
  } catch {
    return null;
  }
}

type Json = Record<string, unknown>;
async function sp(path: string, init?: RequestInit): Promise<Json | null> {
  const token = await accessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${ENDPOINT}${path}`, {
      ...init,
      headers: { "x-amz-access-token": token, "content-type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Json;
  } catch {
    return null;
  }
}

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Drill into a nested object/array path safely.
function dig(obj: unknown, ...keys: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur;
}

// Parse a FeesEstimate object → { total, referral, fba } (shared single/batch).
function parseFeesEstimate(estimate: Json | undefined): SpFees | null {
  if (!estimate) return null;
  const total = num(dig(estimate, "TotalFeesEstimate", "Amount"));
  const details = (dig(estimate, "FeeDetailList") as Json[] | undefined) ?? [];
  let referral = 0, fba = 0, variableClosing = 0;
  for (const d of details) {
    const type = String(dig(d, "FeeType") ?? "");
    const amt = num(dig(d, "FinalFee", "Amount"));
    if (type === "ReferralFee") referral = amt;
    else if (type === "FBAFees" || type === "FulfillmentFees") fba = amt;
    else if (type === "VariableClosingFee") variableClosing = amt;
  }
  return total > 0 ? { total: +total.toFixed(2), referral: +referral.toFixed(2), fba: +fba.toFixed(2), variableClosing } : null;
}

/** Exact FBA + referral fees for an ASIN at a given sell price. */
export async function getFees(asin: string, price: number): Promise<SpFees | null> {
  if (!asin || price <= 0) return null;
  const data = await sp(`/products/fees/v0/items/${encodeURIComponent(asin)}/feesEstimate`, {
    method: "POST",
    body: JSON.stringify({
      FeesEstimateRequest: {
        MarketplaceId: MARKETPLACE_ID,
        IsAmazonFulfilled: true,
        PriceToEstimateFees: { ListingPrice: { CurrencyCode: "USD", Amount: price } },
        Identifier: "samsnipe-1",
      },
    }),
  });
  return parseFeesEstimate(dig(data, "payload", "FeesEstimateResult", "FeesEstimate") as Json | undefined);
}

/** Exact fees for many ASINs in batched calls (up to 20 per request). */
export async function getFeesBatch(items: { asin: string; price: number }[]): Promise<Map<string, SpFees>> {
  const out = new Map<string, SpFees>();
  if (!spApiEnabled()) return out;
  const valid = items.filter((it) => it.asin && it.asin !== "—" && it.price > 0);
  for (let i = 0; i < valid.length; i += 20) {
    if (i > 0) await sleep(400);
    const chunk = valid.slice(i, i + 20);
    const data = await sp(`/products/fees/v0/feesEstimate`, {
      method: "POST",
      body: JSON.stringify({
        FeesEstimateByIdRequestList: chunk.map((it) => ({
          FeesEstimateRequest: {
            MarketplaceId: MARKETPLACE_ID,
            IsAmazonFulfilled: true,
            PriceToEstimateFees: { ListingPrice: { CurrencyCode: "USD", Amount: it.price } },
            Identifier: it.asin,
          },
          IdType: "ASIN",
          IdValue: it.asin,
        })),
      }),
    });
    const list = (Array.isArray(data) ? data : dig(data, "payload")) as Json[] | undefined;
    for (const row of list ?? []) {
      const asin = String(dig(row, "FeesEstimateIdentifier", "IdValue") ?? "");
      const fees = parseFeesEstimate(dig(row, "FeesEstimateResult", "FeesEstimate") as Json | undefined);
      if (asin && fees) out.set(asin, fees);
    }
  }
  return out;
}

/** Buy Box price + competition (offer counts). */
export async function getBuyBox(asin: string): Promise<SpBuyBox | null> {
  if (!asin) return null;
  const data = await sp(`/products/pricing/v0/items/${encodeURIComponent(asin)}/offers?MarketplaceId=${MARKETPLACE_ID}&ItemCondition=New`);
  const summary = dig(data, "payload", "Summary") as Json | undefined;
  if (!summary) return null;
  const buyBoxPrices = dig(summary, "BuyBoxPrices") as Json[] | undefined;
  const buyBoxPrice = buyBoxPrices?.length ? num(dig(buyBoxPrices[0], "ListingPrice", "Amount")) : null;
  const offerCounts = (dig(summary, "NumberOfOffers") as Json[] | undefined) ?? [];
  let offerCount = 0, fbaOffers = 0;
  for (const o of offerCounts) {
    const c = num(dig(o, "OfferCount"));
    offerCount += c;
    if (String(dig(o, "fulfillmentChannel") ?? dig(o, "FulfillmentChannel") ?? "") === "Amazon") fbaOffers += c;
  }
  return { buyBoxPrice, offerCount, fbaOffers };
}

/** Whether you're allowed to list this ASIN (gating / brand approval). */
export async function getGating(asin: string): Promise<SpGating | null> {
  if (!asin || !SELLER_ID) return null;
  const data = await sp(`/listings/restrictions?asin=${encodeURIComponent(asin)}&conditionType=new_new&sellerId=${encodeURIComponent(SELLER_ID)}&marketplaceIds=${MARKETPLACE_ID}`);
  const restrictions = dig(data, "restrictions") as Json[] | undefined;
  if (!Array.isArray(restrictions)) return null;
  if (restrictions.length === 0) return { gated: false, reasons: [] };
  const reasons: string[] = [];
  let approvalUrl: string | undefined;
  for (const r of restrictions) {
    const rs = (dig(r, "reasons") as Json[] | undefined) ?? [];
    for (const reason of rs) {
      const msg = String(dig(reason, "message") ?? "Approval required");
      reasons.push(msg);
      const links = (dig(reason, "links") as Json[] | undefined) ?? [];
      if (links.length && !approvalUrl) approvalUrl = String(dig(links[0], "resource") ?? "");
    }
  }
  return { gated: true, reasons, approvalUrl };
}

export interface SpCatalogItem { asin: string; title: string; brand: string; category: string; bsr: number }

function parseCatalogItem(item: Json | undefined): SpCatalogItem | null {
  if (!item) return null;
  const asin = String(dig(item, "asin") ?? "");
  if (!asin) return null;
  const summary = (dig(item, "summaries") as Json[] | undefined)?.[0];
  const ranks = (dig(item, "salesRanks") as Json[] | undefined)?.[0];
  const dgr = (dig(ranks, "displayGroupRanks") as Json[] | undefined)?.[0]
    ?? (dig(ranks, "classificationRanks") as Json[] | undefined)?.[0];
  return {
    asin,
    title: String(dig(summary, "itemName") ?? ""),
    brand: String(dig(summary, "brand") ?? ""),
    category: String(dig(dgr, "title") ?? dig(summary, "browseClassification", "displayName") ?? ""),
    bsr: num(dig(dgr, "rank")),
  };
}

/** Resolve a UPC/EAN to an Amazon catalog item (ASIN, title, brand, BSR). */
export async function catalogByUpc(upc: string): Promise<SpCatalogItem | null> {
  if (!upc) return null;
  const data = await sp(`/catalog/2022-04-01/items?identifiers=${encodeURIComponent(upc)}&identifiersType=UPC&marketplaceIds=${MARKETPLACE_ID}&includedData=summaries,salesRanks`);
  return parseCatalogItem((dig(data, "items") as Json[] | undefined)?.[0]);
}

/** Keyword search the Amazon catalog → best-match item (token-free vs Keepa). */
export async function catalogSearch(keywords: string): Promise<SpCatalogItem | null> {
  if (!keywords.trim()) return null;
  const data = await sp(`/catalog/2022-04-01/items?keywords=${encodeURIComponent(keywords)}&marketplaceIds=${MARKETPLACE_ID}&includedData=summaries,salesRanks&pageSize=5`);
  return parseCatalogItem((dig(data, "items") as Json[] | undefined)?.[0]);
}

export interface SpResolved { asin: string; title: string; brand: string; category: string; bsr: number; price: number; offerCount: number }

/**
 * Resolve a discovered product to real Amazon data WITHOUT spending Keepa tokens:
 * catalog (ASIN + BSR) + Buy Box price. Returns null unless we get a real price,
 * so callers can fall back to Keepa/estimate. Fees come later (drawer, on-demand).
 */
export async function resolveAmazon(q: { upc?: string; title: string; brand?: string }): Promise<SpResolved | null> {
  if (!spApiEnabled()) return null;
  let item = q.upc ? await catalogByUpc(q.upc) : null;
  if (!item) item = await catalogSearch(`${q.brand ?? ""} ${q.title}`.trim());
  if (!item?.asin) return null;
  const bb = await getBuyBox(item.asin);
  const price = bb?.buyBoxPrice ?? null;
  if (price == null || price <= 0) return null;
  return {
    asin: item.asin,
    title: item.title || q.title,
    brand: item.brand || q.brand || "",
    category: item.category || "Home & Kitchen",
    bsr: item.bsr || 0,
    price,
    offerCount: bb?.offerCount ?? 0,
  };
}

/**
 * Replace the estimated fees on the top deals with EXACT Amazon fees (SP-API),
 * recomputing profit/ROI. Skips deals without a real ASIN (returns null). Capped
 * to keep latency/rate-limits sane; only runs when SP-API is configured.
 */
export async function applyLiveFees(deals: Deal[], limit: number): Promise<Deal[]> {
  if (!spApiEnabled() || deals.length === 0 || limit <= 0) return deals;
  const targets = [...deals]
    .sort((a, b) => b.roi - a.roi)
    .filter((d) => d.match.asin && d.match.asin !== "—")
    .slice(0, limit);
  if (targets.length === 0) return deals;
  // One batched call per 20 ASINs instead of one call each.
  const feeMap = await getFeesBatch(targets.map((d) => ({ asin: d.match.asin, price: d.amazonPrice })));
  if (feeMap.size === 0) return deals;
  return deals.map((d) => {
    const f = feeMap.get(d.match.asin);
    if (!f || f.total <= 0) return d;
    const profit = +(d.amazonPrice - d.sourcePrice - f.total).toFixed(2);
    const roi = d.sourcePrice > 0 ? +((profit / d.sourcePrice) * 100).toFixed(1) : 0;
    const margin = d.amazonPrice > 0 ? +((profit / d.amazonPrice) * 100).toFixed(1) : 0;
    return { ...d, fbaFees: f.total, feesSource: "spapi", profit, roi, margin };
  });
}

/** Everything for a deal's drawer in one call (each piece independent). */
export async function getEconomics(asin: string, price: number): Promise<SpEconomics> {
  const [fees, buyBox, gating] = await Promise.all([getFees(asin, price), getBuyBox(asin), getGating(asin)]);
  return { fees, buyBox, gating };
}

/** Diagnostic for the /setup page. */
export async function spApiStatus(): Promise<{ configured: boolean; ok: boolean; sellerId: boolean; reason: string }> {
  if (!spApiEnabled()) {
    return { configured: false, ok: false, sellerId: Boolean(SELLER_ID), reason: "Set SPAPI_CLIENT_ID, SPAPI_CLIENT_SECRET and SPAPI_REFRESH_TOKEN." };
  }
  const token = await accessToken();
  if (!token) return { configured: true, ok: false, sellerId: Boolean(SELLER_ID), reason: "Credentials present but LWA token exchange failed — check the client id/secret/refresh token." };
  return {
    configured: true, ok: true, sellerId: Boolean(SELLER_ID),
    reason: SELLER_ID ? "Connected — live fees, Buy Box & gating." : "Connected — live fees & Buy Box. Add SPAPI_SELLER_ID for gating checks.",
  };
}
