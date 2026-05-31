import type { AsinMatch, RiskFlag, Verdict } from "@/lib/types";
import { confColor, RISK_LABELS, VERDICT_META } from "@/lib/format";
import type { SurvivalBand } from "@/lib/survival";
import { SURVIVAL_COLOR } from "@/lib/survival";

// Account-survival shield: 0–100, colored by band. The trust-and-safety signal.
export function SurvivalShield({
  score, band, size = "sm", showLabel = false,
}: {
  score: number;
  band: SurvivalBand;
  size?: "sm" | "lg";
  showLabel?: boolean;
}) {
  const c = SURVIVAL_COLOR[band];
  const big = size === "lg";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-semibold"
      style={{
        color: c,
        background: `${c}1f`,
        padding: big ? "4px 10px" : "2px 7px",
        fontSize: big ? 13 : 11,
      }}
      title={`Account-survival score: ${score}/100 (${band})`}
    >
      <svg width={big ? 14 : 11} height={big ? 14 : 11} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3z" />
      </svg>
      {score}
      {showLabel && <span className="font-medium capitalize opacity-80">· {band}</span>}
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const m = VERDICT_META[verdict];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: m.color, background: m.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

// Circular ASIN-match confidence ring — the trust signal of the whole app.
export function ConfidenceRing({ match, size = 46 }: { match: AsinMatch; size?: number }) {
  const c = confColor(match.confidence);
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - match.confidence / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={match.rationale}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold" style={{ color: c }}>{match.confidence}</span>
      </div>
    </div>
  );
}

export function RiskChip({ risk }: { risk: RiskFlag }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#f4476b]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#f88aa1]">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2 1 21h22L12 2zm0 6 6.5 11h-13L12 8zm-1 3v4h2v-4h-2zm0 5v2h2v-2h-2z" />
      </svg>
      {RISK_LABELS[risk]}
    </span>
  );
}
