// Persistent buy list — the deals you've committed to source, with quantities
// and status, plus live ROI/capital tracking. localStorage now; Supabase later.

import type { Deal } from "./types";

export type BuyStatus = "to_buy" | "ordered" | "received";

export interface BuyItem {
  deal: Deal;
  qty: number;
  status: BuyStatus;
  addedAt: string;
}

export interface BuyTotals {
  units: number;
  capital: number; // total cost outlay
  projectedRevenue: number;
  projectedProfit: number;
  avgRoi: number;
  lines: number;
}

const KEY = "samsnipe.buylist.v1";

export function loadBuyList(): BuyItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BuyItem[]) : [];
  } catch {
    return [];
  }
}

export function saveBuyList(items: BuyItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

export function addToBuyList(items: BuyItem[], deal: Deal, qty = 1): BuyItem[] {
  const existing = items.find((i) => i.deal.id === deal.id);
  if (existing) {
    return items.map((i) =>
      i.deal.id === deal.id ? { ...i, qty: i.qty + qty } : i
    );
  }
  return [{ deal, qty, status: "to_buy", addedAt: new Date().toISOString() }, ...items];
}

export function computeTotals(items: BuyItem[]): BuyTotals {
  let units = 0, capital = 0, projectedRevenue = 0, projectedProfit = 0;
  for (const i of items) {
    units += i.qty;
    capital += i.deal.sourcePrice * i.qty;
    projectedRevenue += i.deal.amazonPrice * i.qty;
    projectedProfit += i.deal.profit * i.qty;
  }
  const avgRoi = capital > 0 ? (projectedProfit / capital) * 100 : 0;
  return { units, capital, projectedRevenue, projectedProfit, avgRoi, lines: items.length };
}
