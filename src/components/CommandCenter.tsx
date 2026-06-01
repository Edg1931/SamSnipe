"use client";

import { useMemo } from "react";
import type { Deal } from "@/lib/types";
import { usd } from "@/lib/format";
import { dealScore } from "@/lib/score";
import { assessTrust } from "@/lib/trust";
import { DealCard } from "./DealCard";
import { DealGridSkeleton } from "./Skeleton";

// The daily decision surface: stats, Auto-Pilot finds, and today's best buys.
export function CommandCenter({
  deals, dataSource, findingsCount, scanning, discovering, loading,
  onOpenDeal, onSeeAll, onRunScan, onDiscover, onOpenAutoPilot,
}: {
  deals: Deal[];
  dataSource: string;
  findingsCount: number;
  scanning: boolean;
  discovering: boolean;
  loading: boolean;
  onOpenDeal: (d: Deal) => void;
  onSeeAll: () => void;
  onRunScan: () => void;
  onDiscover: () => void;
  onOpenAutoPilot: () => void;
}) {
  // Show every deal, ranked best-first: Keepa-verified, then BUY-grade, then
  // Deal Score — so the strongest buys lead but nothing is hidden.
  const ranked = useMemo(() => {
    return [...deals].sort((a, b) => {
      const av = assessTrust(a).level === "verified" ? 1 : 0;
      const bv = assessTrust(b).level === "verified" ? 1 : 0;
      if (av !== bv) return bv - av;
      const aBuy = a.verdict === "BUY" ? 1 : 0;
      const bBuy = b.verdict === "BUY" ? 1 : 0;
      if (aBuy !== bBuy) return bBuy - aBuy;
      return dealScore(b).score - dealScore(a).score;
    });
  }, [deals]);

  const stats = useMemo(() => {
    const buys = deals.filter((d) => d.verdict === "BUY");
    const verified = deals.filter((d) => assessTrust(d).level === "verified").length;
    const avgRoi = deals.length ? deals.reduce((a, d) => a + d.roi, 0) / deals.length : 0;
    const profit = buys.reduce((a, d) => a + d.profit * Math.min(d.monthlySales, 30), 0);
    return { found: deals.length, buys: buys.length, verified, avgRoi, profit };
  }, [deals]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="px-5 py-5 pb-24 lg:pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">{greeting} — today&apos;s sourcing</h1>
          <p className="text-[12px] text-text-dim">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            {dataSource !== "mock" ? " · live Keepa data" : " · demo data"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onDiscover} disabled={discovering} className="rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2 text-[13px] font-medium text-accent hover:bg-accent/15 disabled:opacity-60">
            {discovering ? "Searching web…" : "✦ AI Discover"}
          </button>
          <button onClick={onRunScan} disabled={scanning} className="rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-black hover:opacity-90 disabled:opacity-60">
            {scanning ? "Scanning…" : "Run Scan"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Deals found" value={String(stats.found)} sub={`${stats.verified} Keepa-verified`} tone="#10d98e" icon="🎯" />
        <Stat label="BUY signals" value={String(stats.buys)} sub="ready to source" tone="#84cc16" icon="✅" />
        <Stat label="Avg ROI" value={`${stats.avgRoi.toFixed(0)}%`} sub="across finds" tone="#f5a524" icon="📈" />
        <Stat label="Est. monthly profit" value={usd(stats.profit)} sub="if you buy the winners" tone="#6366f1" icon="💰" />
      </div>

      {/* Auto-Pilot callout */}
      {findingsCount > 0 && (
        <button onClick={onOpenAutoPilot} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-left transition hover:bg-accent/15">
          <span className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/20 text-accent">⚡</span>
            <span>
              <span className="block text-[13px] font-semibold text-text">Auto-Pilot found {findingsCount} new deal{findingsCount === 1 ? "" : "s"} while you were away</span>
              <span className="block text-[11px] text-text-dim">Tap to review your findings inbox</span>
            </span>
          </span>
          <span className="text-accent">→</span>
        </button>
      )}

      {/* Today's deals — best first */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-text">Today&apos;s deals · {stats.found} found <span className="font-normal text-text-faint">— best first</span></h2>
        <button onClick={onSeeAll} className="text-[12px] font-medium text-accent hover:underline">Open full feed (filters, table) →</button>
      </div>

      {loading && ranked.length === 0 ? (
        <DealGridSkeleton />
      ) : ranked.length === 0 ? (
        <div className="mt-4 grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="text-3xl">🎯</div>
          <p className="mt-2 text-sm font-medium text-text">No deals yet</p>
          <p className="text-[12px] text-text-dim">Run a scan or AI Discover to surface fresh, high-ROI finds.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ranked.map((d) => (
            <DealCard key={d.id} deal={d} onClick={() => onOpenDeal(d)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone, icon }: { label: string; value: string; sub: string; tone: string; icon: string }) {
  return (
    <div className="glass rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-text-faint">{label}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <div className="mt-1.5 text-2xl font-bold" style={{ color: tone }}>{value}</div>
      <div className="text-[11px] text-text-dim">{sub}</div>
    </div>
  );
}
