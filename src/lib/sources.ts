// Target sources the agent scans. Persisted in localStorage so the user's
// custom site list survives reloads (a Supabase-backed list comes later).

export interface TargetSite {
  id: string;
  label: string; // e.g. "Walmart"
  domain: string; // e.g. "walmart.com"
  enabled: boolean;
  custom: boolean; // user-added vs default
}

// Curated from the retailers Amazon online/retail-arbitrage sellers source from
// most (big-box clearance + discount chains). The strongest general-merchandise
// sources are on by default; toggle the rest on as you like.
export const DEFAULT_SITES: TargetSite[] = [
  { id: "walmart", label: "Walmart", domain: "walmart.com", enabled: true, custom: false },
  { id: "target", label: "Target", domain: "target.com", enabled: true, custom: false },
  { id: "homedepot", label: "Home Depot", domain: "homedepot.com", enabled: true, custom: false },
  { id: "lowes", label: "Lowe's", domain: "lowes.com", enabled: true, custom: false },
  { id: "bestbuy", label: "Best Buy", domain: "bestbuy.com", enabled: true, custom: false },
  { id: "kohls", label: "Kohl's", domain: "kohls.com", enabled: true, custom: false },
  { id: "macys", label: "Macy's", domain: "macys.com", enabled: true, custom: false },
  { id: "biglots", label: "Big Lots", domain: "biglots.com", enabled: true, custom: false },
  { id: "costco", label: "Costco", domain: "costco.com", enabled: false, custom: false },
  { id: "samsclub", label: "Sam's Club", domain: "samsclub.com", enabled: false, custom: false },
  { id: "wayfair", label: "Wayfair", domain: "wayfair.com", enabled: false, custom: false },
  { id: "zoro", label: "Zoro", domain: "zoro.com", enabled: false, custom: false },
  { id: "staples", label: "Staples", domain: "staples.com", enabled: false, custom: false },
  { id: "officedepot", label: "Office Depot", domain: "officedepot.com", enabled: false, custom: false },
  { id: "cvs", label: "CVS", domain: "cvs.com", enabled: false, custom: false },
  { id: "walgreens", label: "Walgreens", domain: "walgreens.com", enabled: false, custom: false },
  { id: "qvc", label: "QVC", domain: "qvc.com", enabled: false, custom: false },
  { id: "jcpenney", label: "JCPenney", domain: "jcpenney.com", enabled: false, custom: false },
  { id: "ebay", label: "eBay", domain: "ebay.com", enabled: false, custom: false },
];

const KEY = "samsnipe.sources.v1";
const AI_KEY = "samsnipe.aiSearch.v1";

export function loadSources(): TargetSite[] {
  if (typeof window === "undefined") return DEFAULT_SITES;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SITES;
    const saved = JSON.parse(raw) as TargetSite[];
    if (!Array.isArray(saved)) return DEFAULT_SITES;
    // Merge in any newly-shipped default sources the user hasn't seen, while
    // preserving their existing toggles and custom additions.
    const have = new Set(saved.map((s) => s.id));
    const merged = [...saved];
    for (const d of DEFAULT_SITES) if (!have.has(d.id)) merged.push(d);
    return merged;
  } catch {
    return DEFAULT_SITES;
  }
}

export function saveSources(s: TargetSite[]) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function loadAiSearch(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(AI_KEY) !== "0";
}

export function saveAiSearch(on: boolean) {
  try { localStorage.setItem(AI_KEY, on ? "1" : "0"); } catch {}
}

// Turn "https://www.walmart.com/cp/clearance" into a clean domain + label.
export function parseSiteInput(input: string): { label: string; domain: string } | null {
  const t = input.trim();
  if (!t) return null;
  let domain = t.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  if (!domain.includes(".")) domain = `${domain}.com`;
  const label = domain.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
  return { label, domain };
}
