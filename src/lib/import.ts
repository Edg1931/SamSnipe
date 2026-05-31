// Spreadsheet import: auto-detect the user's columns (ASIN, cost, price, UPC,
// title, brand, category, BSR) no matter how they're named, then turn each row
// into a fully-analyzed Deal using the same profit + verdict logic as a scan.

import { calcProfit } from "./profit";
import { decideVerdict, swatchFor } from "./verdict";
import { analyzeManifest, type ManifestAnalysis } from "./manifest";
import type { AsinMatch, Deal, RiskFlag } from "./types";

export type Field =
  | "asin" | "upc" | "title" | "brand" | "category"
  | "cost" | "sell" | "bsr" | "url" | "qty";

// Header synonyms — lowercased, non-alphanumerics stripped before matching.
const SYNONYMS: Record<Field, string[]> = {
  asin: ["asin", "amazonasin", "asinnumber", "asincode"],
  upc: ["upc", "ean", "gtin", "barcode", "upcean", "productcode", "code"],
  title: ["title", "name", "productname", "product", "item", "itemname", "description", "desc"],
  brand: ["brand", "manufacturer", "make", "vendor"],
  category: ["category", "cat", "department", "producttype", "type"],
  cost: ["cost", "buyprice", "buycost", "sourceprice", "wholesale", "wholesaleprice", "unitcost", "yourcost", "purchaseprice", "supplierprice"],
  sell: ["sell", "sellprice", "saleprice", "amazonprice", "listprice", "price", "buyboxprice", "retail", "retailprice", "currentprice"],
  bsr: ["bsr", "rank", "salesrank", "bestsellersrank", "bestsellerrank"],
  url: ["url", "link", "sourceurl", "producturl", "productlink", "listingurl", "href", "weblink"],
  qty: ["qty", "quantity", "units", "cases", "casepack", "count", "pcs", "pieces"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface ColumnMap {
  /** field -> the original header it matched, or null if not found. */
  mapping: Record<Field, string | null>;
  /** headers we couldn't place. */
  unmatched: string[];
}

export function detectColumns(headers: string[]): ColumnMap {
  const mapping = {} as Record<Field, string | null>;
  const used = new Set<string>();
  (Object.keys(SYNONYMS) as Field[]).forEach((field) => {
    mapping[field] = null;
    for (const h of headers) {
      if (used.has(h)) continue;
      const nh = norm(h);
      if (SYNONYMS[field].some((syn) => nh === syn || nh.includes(syn))) {
        mapping[field] = h;
        used.add(h);
        break;
      }
    }
  });
  const unmatched = headers.filter((h) => !used.has(h));
  return { mapping, unmatched };
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function buildMatch(asin: string, upc: string, title: string): AsinMatch {
  if (asin) {
    return {
      asin: asin.toUpperCase(),
      confidence: 100,
      method: ["UPC_EAN"],
      rationale: "ASIN supplied directly in your spreadsheet — authoritative, no matching needed.",
    };
  }
  if (upc) {
    return {
      asin: "—",
      confidence: 88,
      method: ["UPC_EAN"],
      rationale: `Row has UPC/EAN ${upc} but no ASIN. Will resolve to an ASIN via Amazon catalog on next sync.`,
    };
  }
  return {
    asin: "—",
    confidence: 55,
    method: ["TITLE_AI"],
    rationale: `No ASIN or UPC on this row — only "${title.slice(0, 40)}". Needs AI title/image matching before it's trustworthy.`,
    packSizeWarning: true,
  };
}

export interface ImportResult {
  deals: Deal[];
  columnMap: ColumnMap;
  rowsRead: number;
  skipped: number;
  /** Per-line quantities (aligned with `deals`), defaulting to 1. */
  quantities: number[];
  /** Pallet-level analysis — present when a quantity column is detected. */
  manifest?: ManifestAnalysis;
}

export function rowsToDeals(rows: Record<string, unknown>[], sourceLabel = "Imported"): ImportResult {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columnMap = detectColumns(headers);
  const m = columnMap.mapping;
  const deals: Deal[] = [];
  const quantities: number[] = [];
  let skipped = 0;

  rows.forEach((row, i) => {
    const title = String((m.title && row[m.title]) ?? "").trim();
    const asin = String((m.asin && row[m.asin]) ?? "").trim();
    const upc = String((m.upc && row[m.upc]) ?? "").trim();
    const cost = m.cost ? num(row[m.cost]) : 0;
    const sell = m.sell ? num(row[m.sell]) : 0;

    // Need at least something to identify the item and a price to analyze.
    if ((!title && !asin && !upc) || sell <= 0) {
      skipped++;
      return;
    }

    const brand = String((m.brand && row[m.brand]) ?? title.split(" ")[0] ?? "Item").trim();
    const category = String((m.category && row[m.category]) ?? "Home & Kitchen").trim();
    const bsr = m.bsr ? Math.max(1, Math.round(num(row[m.bsr]))) : 120000;
    const url = String((m.url && row[m.url]) ?? "").trim();
    const qty = m.qty ? Math.max(1, Math.round(num(row[m.qty]))) : 1;

    const { profit, roi, margin, totalFees } = calcProfit({ cost, sellPrice: sell, category });
    const match = buildMatch(asin, upc, title || brand);

    const risks: RiskFlag[] = [];
    if (match.packSizeWarning) risks.push("VARIATION_MISMATCH");
    if (bsr > 250000) risks.push("LOW_SELL_THROUGH");

    const { verdict, reason } = decideVerdict(roi, match.confidence, risks);

    deals.push({
      id: `import_${Date.now()}_${i}`,
      title: title || `${brand} item`,
      brand,
      category,
      imageColor: swatchFor(brand),
      match,
      source: sourceLabel,
      origin: "import",
      sourceUrl: url || "#",
      sourcePrice: cost,
      amazonPrice: sell,
      bsr,
      bsrCategory: category,
      monthlySales: Math.max(1, Math.floor(40000 / Math.sqrt(bsr + 50))),
      offerCount: 0,
      profit,
      roi,
      margin,
      fbaFees: totalFees,
      verdict,
      verdictReason: reason,
      risks,
      priceHistory: flatHistory(sell),
      foundAt: new Date().toISOString(),
    });
    quantities.push(qty);
  });

  // If the sheet carries quantities, treat it as a pallet manifest and score it.
  const manifest = m.qty
    ? analyzeManifest(deals.map((deal, i) => ({ deal, qty: quantities[i] ?? 1 })))
    : undefined;

  return { deals, columnMap, rowsRead: rows.length, skipped, quantities, manifest };
}

// Imported rows have no history yet; show a flat line at the listed price.
function flatHistory(price: number) {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => ({
    t: new Date(now - (29 - i) * 86400000).toISOString().slice(0, 10),
    price,
  }));
}
