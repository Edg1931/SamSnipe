// Builds real, clickable destination URLs for a deal.
// - Amazon: deep-link straight to the ASIN's product page (amazon.com/dp/ASIN).
// - Source: if we have the exact listing URL use it; otherwise build a search
//   URL on that retailer for the product title so the link always goes somewhere.

const RETAIL_SEARCH: Record<string, (q: string) => string> = {
  "walmart.com": (q) => `https://www.walmart.com/search?q=${q}`,
  "target.com": (q) => `https://www.target.com/s?searchTerm=${q}`,
  "homedepot.com": (q) => `https://www.homedepot.com/s/${q}`,
  "bestbuy.com": (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${q}`,
  "ebay.com": (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}`,
  "costco.com": (q) => `https://www.costco.com/CatalogSearch?keyword=${q}`,
  "kohls.com": (q) => `https://www.kohls.com/search.jsp?search=${q}`,
};

// Map our display source names → domains used for search URLs.
const NAME_TO_DOMAIN: Record<string, string> = {
  Walmart: "walmart.com",
  Target: "target.com",
  "Home Depot": "homedepot.com",
  "Best Buy": "bestbuy.com",
  eBay: "ebay.com",
  Costco: "costco.com",
  "Kohl's": "kohls.com",
};

export function amazonUrl(asin: string): string | null {
  if (!asin || asin === "—" || !/^[A-Z0-9]{10}$/i.test(asin)) return null;
  return `https://www.amazon.com/dp/${asin}`;
}

/** Keepa's authoritative price/BSR history page for an ASIN (domain 1 = US). */
export function keepaUrl(asin: string): string | null {
  if (!asin || asin === "—" || !/^[A-Z0-9]{10}$/i.test(asin)) return null;
  return `https://keepa.com/#!product/1-${asin}`;
}

export function amazonSearch(q: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
}

/** Amazon Best Sellers for a department — the page BSR is measured against. */
export function amazonBestSellers(category: string): string {
  return `https://www.amazon.com/Best-Sellers/zgbs?k=${encodeURIComponent(category)}`;
}

export function sourceSearchUrl(source: string, title: string): string {
  const q = encodeURIComponent(title);
  const domain = NAME_TO_DOMAIN[source] ?? source.toLowerCase();
  const builder = RETAIL_SEARCH[domain];
  if (builder) return builder(q);
  // Custom domain or web search — fall back to a Google search scoped to it.
  if (domain.includes(".")) return `https://www.google.com/search?q=${q}+site:${domain}`;
  return `https://www.google.com/search?q=${q}`;
}

/** Resolve the best outbound link for a deal's source. */
export function resolveSourceUrl(opts: {
  source: string;
  title: string;
  sourceUrl?: string;
}): string {
  const { source, title, sourceUrl } = opts;
  if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  return sourceSearchUrl(source, title);
}

/** Home page of a retailer domain — for verifying a source site is what you expect. */
export function storeHomeUrl(domain: string): string {
  const d = domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  return `https://${d}`;
}

/**
 * Verification link for a resale (exit) channel: opens that marketplace's
 * listings for this product so you can confirm the estimated sell price.
 * eBay deep-links to SOLD/completed listings — the gold standard for comps.
 */
export function channelUrl(
  channel: string,
  opts: { asin?: string; title: string; brand?: string }
): string {
  // Prepend the brand only when the title doesn't already include it.
  const brand = opts.brand?.trim() ?? "";
  const term = brand && !opts.title.toLowerCase().includes(brand.toLowerCase())
    ? `${brand} ${opts.title}`.trim()
    : opts.title.trim();
  const q = encodeURIComponent(term);
  switch (channel) {
    case "Amazon":
      return (opts.asin && amazonUrl(opts.asin)) || amazonSearch(term);
    case "eBay":
      return `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`;
    case "Walmart":
      return `https://www.walmart.com/search?q=${q}`;
    case "Mercari":
      return `https://www.mercari.com/search/?keyword=${q}`;
    case "TikTok Shop":
      return `https://www.tiktok.com/search/shop?q=${q}`;
    default:
      return amazonSearch(term);
  }
}
