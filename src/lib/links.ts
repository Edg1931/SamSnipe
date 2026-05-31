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
  if (!asin || asin === "—" || !/^B0/i.test(asin)) return null;
  return `https://www.amazon.com/dp/${asin}`;
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
