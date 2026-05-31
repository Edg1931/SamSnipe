// Auto-Pilot — saved sourcing briefs the agent runs for you, so finding deals
// becomes hands-off. Each watch is a natural-language brief ("toys under $20,
// 50% ROI, BSR < 100k"); the app shows how many current finds match and lets
// you run any watch in one click. Scheduled background runs + alerts are the
// backend follow-up (Vercel Cron + Supabase + push/email) — this is the control
// surface for them.

import type { Deal } from "./types";
import { parseQuery, applyQuery } from "./search";

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  enabled: boolean;
  createdAt: string;
}

const KEY = "samsnipe.autopilot.v1";

export function loadSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedSearch[]) : SEED;
  } catch {
    return SEED;
  }
}

export function saveSearches(list: SavedSearch[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

// Sensible starter watches so Auto-Pilot is useful immediately.
const SEED: SavedSearch[] = [
  { id: "seed-toys", name: "High-ROI toys", query: "toys with 50% ROI, BSR under 100000", enabled: true, createdAt: new Date().toISOString() },
  { id: "seed-winners", name: "Clean winners", query: "show me only BUY verdicts", enabled: true, createdAt: new Date().toISOString() },
];

export function addSearch(list: SavedSearch[], name: string, query: string): SavedSearch[] {
  return [
    { id: `s_${Date.now()}`, name: name.trim() || query.trim().slice(0, 24), query: query.trim(), enabled: true, createdAt: new Date().toISOString() },
    ...list,
  ];
}

// How many current finds this watch would surface (BUY verdicts), for the
// "matching now" badge — real client-side triage with no backend needed.
export function matchCount(search: SavedSearch, deals: Deal[]): { total: number; buys: number } {
  const matched = applyQuery(deals, parseQuery(search.query));
  return { total: matched.length, buys: matched.filter((d) => d.verdict === "BUY").length };
}
