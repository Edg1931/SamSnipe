"use client";

import type { Deal } from "@/lib/types";
import { usd, compact } from "@/lib/format";
import { dealScore, SCORE_COLOR } from "@/lib/score";
import { computeSurvival, SURVIVAL_COLOR } from "@/lib/survival";
import { assessTrust } from "@/lib/trust";
import { VERDICT_META } from "@/lib/format";

// Dense, scannable table for triaging a big feed fast.
export function DealTable({ deals, onOpen }: { deals: Deal[]; onOpen: (d: Deal) => void }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[1fr_70px_64px_64px_70px_90px_60px] items-center gap-2 border-b border-border bg-bg-card/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
          <span>Product</span>
          <span className="text-right">ROI</span>
          <span className="text-center">Score</span>
          <span className="text-center">Safety</span>
          <span className="text-right">Sold/mo</span>
          <span className="text-right">Cost→Sell</span>
          <span className="text-center">Call</span>
        </div>
        {deals.map((d) => {
          const sc = dealScore(d);
          const sv = computeSurvival(d);
          const tr = assessTrust(d);
          const vm = VERDICT_META[d.verdict];
          const roiColor = d.roi >= 40 ? "#10d98e" : d.roi >= 25 ? "#84cc16" : d.roi >= 15 ? "#f5a524" : "#f4476b";
          return (
            <button
              key={d.id}
              onClick={() => onOpen(d)}
              className="grid w-full grid-cols-[1fr_70px_64px_64px_70px_90px_60px] items-center gap-2 border-b border-border-soft px-3 py-2 text-left text-[12px] transition hover:bg-white/5"
            >
              <span className="flex min-w-0 items-center gap-2">
                {d.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded bg-white/5 object-contain" />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded text-[10px] font-bold text-white/90" style={{ background: `linear-gradient(135deg, ${d.imageColor}, ${d.imageColor}99)` }}>
                    {d.brand.slice(0, 2)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tr.color }} title={tr.label} />
                    <span className="truncate font-medium text-text">{d.title}</span>
                    {tr.stale && <span className="shrink-0 text-[9px] text-warn" title="Price may be stale">⏱</span>}
                  </span>
                  <span className="block truncate text-[10px] text-text-faint">{d.brand} · {d.category}</span>
                </span>
              </span>
              <span className="text-right font-semibold" style={{ color: roiColor }}>{d.roi}%</span>
              <span className="text-center">
                <span className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ color: SCORE_COLOR[sc.band], background: `${SCORE_COLOR[sc.band]}1f` }}>{sc.score}</span>
              </span>
              <span className="text-center font-mono" style={{ color: SURVIVAL_COLOR[sv.band] }}>{sv.score}</span>
              <span className="text-right text-text-dim">{compact(d.monthlySales)}</span>
              <span className="text-right text-text-dim">{usd(d.sourcePrice)}→{usd(d.amazonPrice)}</span>
              <span className="text-center">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: vm.color }} title={vm.label} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
