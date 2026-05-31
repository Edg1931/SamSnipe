// #3 Ungating-aware sourcing. Cross-references each deal against the brands and
// categories YOU are approved (ungated) to sell, and flags purchases that can
// double as an ungating invoice — buy from a real distributor and the same
// receipt unlocks the brand. Nobody fuses sourcing with ungating.

import type { Deal } from "./types";
import { GATED_CATEGORIES, isIpRiskBrand } from "./survival";

export interface Approvals {
  brands: string[]; // brands you're ungated for
  categories: string[]; // categories you're ungated for
}

const KEY = "samsnipe.approvals.v1";

export function loadApprovals(): Approvals {
  if (typeof window === "undefined") return { brands: [], categories: [] };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Approvals) : { brands: [], categories: [] };
  } catch {
    return { brands: [], categories: [] };
  }
}

export function saveApprovals(a: Approvals) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {}
}

const norm = (s: string) => s.trim().toLowerCase();

export type GateStatus = "open" | "approved" | "gated";

export interface Ungating {
  gated: boolean;
  status: GateStatus;
  /** This purchase could unlock the brand if it comes with a valid invoice. */
  canUngate: boolean;
  label: string;
  note: string;
}

// Sources that typically issue the kind of wholesale invoice Amazon accepts for
// ungating (vs a retail receipt, which usually won't cut it).
const DISTRIBUTOR_SOURCES = ["liquidation.com", "Liquidation.com", "Costco"];

export function computeUngating(deal: Deal, approvals: Approvals): Ungating {
  const gated = isIpRiskBrand(deal.brand) || GATED_CATEGORIES.has(deal.category);
  const approvedBrand = approvals.brands.some((b) => norm(b) === norm(deal.brand));
  const approvedCat = approvals.categories.some((c) => norm(c) === norm(deal.category));

  if (!gated) {
    return { gated: false, status: "open", canUngate: false, label: "Ungated", note: "Open category — no approval needed." };
  }
  if (approvedBrand || approvedCat) {
    return { gated: true, status: "approved", canUngate: false, label: "You're approved", note: `You're already ungated for ${approvedBrand ? deal.brand : deal.category}.` };
  }
  // Gated and not approved — is this a purchase that could ungate you?
  const distributor = DISTRIBUTOR_SOURCES.some((d) => norm(deal.source).includes(norm(d)));
  return {
    gated: true,
    status: "gated",
    canUngate: distributor,
    label: distributor ? "Gated — can ungate" : "Gated — approval needed",
    note: distributor
      ? `${deal.source} issues wholesale invoices — this buy could ungate ${deal.brand} for you. Keep the invoice in your vault.`
      : `${deal.brand}/${deal.category} is gated and you're not approved. You'll need ungating before you can list.`,
  };
}
