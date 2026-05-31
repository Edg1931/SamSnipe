// Target sources the agent scans. Persisted in localStorage so the user's
// custom site list survives reloads (a Supabase-backed list comes later).

export interface TargetSite {
  id: string;
  label: string; // e.g. "Walmart"
  domain: string; // e.g. "walmart.com"
  enabled: boolean;
  custom: boolean; // user-added vs default
}

export const DEFAULT_SITES: TargetSite[] = [
  { id: "walmart", label: "Walmart", domain: "walmart.com", enabled: true, custom: false },
  { id: "target", label: "Target", domain: "target.com", enabled: true, custom: false },
  { id: "homedepot", label: "Home Depot", domain: "homedepot.com", enabled: true, custom: false },
  { id: "bestbuy", label: "Best Buy", domain: "bestbuy.com", enabled: false, custom: false },
  { id: "ebay", label: "eBay", domain: "ebay.com", enabled: false, custom: false },
];

const KEY = "samsnipe.sources.v1";
const AI_KEY = "samsnipe.aiSearch.v1";

export function loadSources(): TargetSite[] {
  if (typeof window === "undefined") return DEFAULT_SITES;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TargetSite[]) : DEFAULT_SITES;
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
