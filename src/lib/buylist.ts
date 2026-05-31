// Persistent buy list — the deals you've committed to source, with quantities
// and status, plus live ROI/capital tracking. localStorage now; Supabase later.

import type { Deal } from "./types";

export type BuyStatus = "to_buy" | "ordered" | "received";

// A source invoice attached to a buy — the artifact Amazon demands during an
// authenticity/IP investigation. Having one ready is the difference between a
// one-click reinstatement and a dead account.
export interface Invoice {
  fileName: string;
  /** Stored as a data URL so the prototype keeps it without a backend. */
  dataUrl?: string;
  supplier: string;
  purchaseDate: string; // ISO date
  units: number;
  amount: number; // total invoice amount
  addedAt: string;
}

export interface BuyItem {
  deal: Deal;
  qty: number;
  status: BuyStatus;
  addedAt: string;
  invoice?: Invoice;
}

export type Defensibility = "ready" | "partial" | "none";

// Amazon typically wants an invoice from a verifiable supplier, with your
// details, dated, and ≥10 units of the ASIN. Model that as a simple gate.
export function defensibilityOf(item: BuyItem): {
  level: Defensibility;
  reasons: string[];
} {
  const inv = item.invoice;
  if (!inv) return { level: "none", reasons: ["No invoice attached"] };
  const reasons: string[] = [];
  if (!inv.supplier?.trim()) reasons.push("Missing supplier name");
  if (!inv.purchaseDate) reasons.push("Missing purchase date");
  if (!inv.units || inv.units < 10) reasons.push("Fewer than 10 units (Amazon often requires 10+)");
  if (!inv.dataUrl) reasons.push("No invoice document attached");
  const level: Defensibility = reasons.length === 0 ? "ready" : "partial";
  return { level, reasons };
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

export function setInvoice(items: BuyItem[], dealId: string, invoice: Invoice | undefined): BuyItem[] {
  return items.map((i) => (i.deal.id === dealId ? { ...i, invoice } : i));
}

export interface ComplianceSummary {
  ready: number;
  partial: number;
  none: number;
  /** % of capital that is invoice-defensible. */
  defensiblePct: number;
}

export function complianceSummary(items: BuyItem[]): ComplianceSummary {
  let ready = 0, partial = 0, none = 0, defendedCapital = 0, totalCapital = 0;
  for (const i of items) {
    const cap = i.deal.sourcePrice * i.qty;
    totalCapital += cap;
    const { level } = defensibilityOf(i);
    if (level === "ready") { ready++; defendedCapital += cap; }
    else if (level === "partial") partial++;
    else none++;
  }
  const defensiblePct = totalCapital > 0 ? (defendedCapital / totalCapital) * 100 : 0;
  return { ready, partial, none, defensiblePct };
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
