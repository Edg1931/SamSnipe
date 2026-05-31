// Exempt-brand list: brands the user can't or won't resell (gated, IP-risk,
// MAP-policed, or personal preference). Deals from these brands are filtered
// out of the feed. Persisted in localStorage; matched case-insensitively.

const KEY = "samsnipe.exemptBrands.v1";

export function loadExemptBrands(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveExemptBrands(list: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export const normBrand = (s: string) => s.trim().toLowerCase();

// Accepts a free-form blob ("Sony, Nike\nApple; Dyson") and returns clean,
// de-duplicated brand names, so users can paste a whole list at once.
export function parseBrandInput(input: string, existing: string[] = []): string[] {
  const have = new Set(existing.map(normBrand));
  const out: string[] = [];
  for (const part of input.split(/[\n,;]+/)) {
    const name = part.trim();
    if (!name) continue;
    const key = normBrand(name);
    if (have.has(key)) continue;
    have.add(key);
    out.push(name);
  }
  return out;
}

export function isExempt(brand: string, exempt: string[]): boolean {
  const b = normBrand(brand);
  return exempt.some((e) => normBrand(e) === b);
}
