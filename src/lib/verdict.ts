// Shared deal-scoring logic used by BOTH the mock scan engine and the
// spreadsheet importer, so an imported row is judged exactly like a found deal.

import type { RiskFlag, Verdict } from "./types";

export function decideVerdict(
  roi: number,
  conf: number,
  risks: RiskFlag[]
): { verdict: Verdict; reason: string } {
  if (conf < 75 || risks.includes("VARIATION_MISMATCH"))
    return { verdict: "WATCH", reason: `ASIN match only ${conf}% confident — confirm the exact item before committing.` };
  if (roi >= 40 && risks.length === 0)
    return { verdict: "BUY", reason: `${roi}% ROI with a clean risk profile and strong sell-through. Solid flip.` };
  if (roi >= 30)
    return { verdict: "BUY", reason: `${roi}% ROI clears your threshold; ${risks.length ? "watch the flagged risk" : "demand looks healthy"}.` };
  if (roi >= 15)
    return { verdict: "WATCH", reason: `${roi}% ROI is thin for the risk here — only buy at a deeper discount.` };
  return { verdict: "PASS", reason: `${roi}% ROI doesn't justify the fees and risk on this one.` };
}

// Deterministic-ish color/seed for an imported brand swatch.
const SWATCHES = ["#3b82f6", "#ef4444", "#10b981", "#6366f1", "#f59e0b", "#ec4899", "#14b8a6", "#a855f7", "#0ea5e9", "#eab308"];
export function swatchFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return SWATCHES[h % SWATCHES.length];
}
