import type { RiskFlag, Verdict } from "./types";

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const compact = (n: number) =>
  n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export const RISK_LABELS: Record<RiskFlag, string> = {
  IP_COMPLAINT_RISK: "IP complaint risk",
  GATED_CATEGORY: "Gated category",
  HAZMAT: "Hazmat",
  MELTABLE: "Meltable",
  VARIATION_MISMATCH: "Pack-size mismatch",
  LOW_SELL_THROUGH: "Slow seller",
  BUYBOX_SUPPRESSED: "Buy Box suppressed",
};

export const VERDICT_META: Record<
  Verdict,
  { label: string; color: string; bg: string }
> = {
  BUY: { label: "Buy", color: "#10d98e", bg: "rgba(16,217,142,0.12)" },
  WATCH: { label: "Watch", color: "#f5a524", bg: "rgba(245,165,36,0.12)" },
  PASS: { label: "Pass", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

export function confColor(c: number): string {
  if (c >= 90) return "#10d98e";
  if (c >= 80) return "#84cc16";
  if (c >= 70) return "#f5a524";
  return "#f4476b";
}
