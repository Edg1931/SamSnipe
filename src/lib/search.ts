// Natural-language deal filter. A lightweight rule-based parser stands in for
// the LLM that will eventually turn a sourcing brief into structured criteria.
// Same output shape either way, so the UI never changes when we upgrade it.

import type { Deal, Verdict } from "./types";

export interface ParsedQuery {
  maxCost?: number;
  minRoi?: number;
  maxBsr?: number;
  category?: string;
  brand?: string;
  verdict?: Verdict;
  /** What we understood, echoed back to the user as chips. */
  understood: string[];
}

const CATEGORIES = [
  "Toys", "Electronics", "Home & Kitchen", "Sports & Outdoors",
  "Beauty", "Tools & Home Improvement",
];

export function parseQuery(q: string): ParsedQuery {
  const text = q.toLowerCase();
  const out: ParsedQuery = { understood: [] };

  const cost = text.match(/(?:under|below|<|max)\s*\$?\s*(\d+)/);
  if (cost && /cost|under|below|\$/.test(text)) {
    out.maxCost = +cost[1];
    out.understood.push(`Cost ≤ $${cost[1]}`);
  }

  const roi = text.match(/(\d+)\s*%?\s*(?:\+|plus)?\s*roi/);
  if (roi) {
    out.minRoi = +roi[1];
    out.understood.push(`ROI ≥ ${roi[1]}%`);
  }

  const bsr = text.match(/bsr\s*(?:under|below|<)?\s*([\d,]+)/);
  if (bsr) {
    out.maxBsr = +bsr[1].replace(/,/g, "");
    out.understood.push(`BSR ≤ ${(+bsr[1].replace(/,/g, "")).toLocaleString()}`);
  }

  for (const c of CATEGORIES) {
    if (text.includes(c.toLowerCase().split(" ")[0])) {
      out.category = c;
      out.understood.push(c);
      break;
    }
  }

  if (/\bbuy\b|winners?|profitable/.test(text)) {
    out.verdict = "BUY";
    out.understood.push("BUY verdicts only");
  }

  return out;
}

export function applyQuery(deals: Deal[], pq: ParsedQuery): Deal[] {
  return deals.filter((d) => {
    if (pq.maxCost != null && d.sourcePrice > pq.maxCost) return false;
    if (pq.minRoi != null && d.roi < pq.minRoi) return false;
    if (pq.maxBsr != null && d.bsr > pq.maxBsr) return false;
    if (pq.category && d.category !== pq.category) return false;
    if (pq.verdict && d.verdict !== pq.verdict) return false;
    return true;
  });
}
