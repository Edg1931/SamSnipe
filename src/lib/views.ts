// Saved custom views — a named snapshot of the feed's filter + sort state,
// persisted to localStorage so a seller can flip between sourcing lenses
// (e.g. "Cheap toys", "High-ROI verified") in one tap.

export interface ViewCrit {
  minRoi: number; maxBsr: number; maxCost: number;
  minSurvival: number; minSold: number; category: string;
}

export interface SavedView {
  id: string;
  name: string;
  filter: string;     // ALL | BUY | WATCH | PASS
  sortMode: string;   // score | roi | foryou
  verifiedOnly: boolean;
  crit: ViewCrit;
}

const KEY = "samsnipe.views";

export function loadViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveViews(views: SavedView[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(views));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

export function viewMatches(v: SavedView, cur: Omit<SavedView, "id" | "name">): boolean {
  return (
    v.filter === cur.filter &&
    v.sortMode === cur.sortMode &&
    v.verifiedOnly === cur.verifiedOnly &&
    JSON.stringify(v.crit) === JSON.stringify(cur.crit)
  );
}
