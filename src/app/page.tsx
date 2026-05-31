"use client";

import { useEffect, useMemo, useState } from "react";
import type { Deal, Verdict } from "@/lib/types";
import { usd } from "@/lib/format";
import { Sidebar } from "@/components/Sidebar";
import { DealCard } from "@/components/DealCard";
import { DealDetail } from "@/components/DealDetail";

const SUGGESTIONS = [
  "Toys under $20 with 50% ROI",
  "Electronics, BSR under 50,000",
  "Show me only BUY verdicts",
  "Home & Kitchen 40% ROI",
];

type Filter = "ALL" | Verdict;

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [understood, setUnderstood] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState("mock");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [seed, setSeed] = useState(7);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<Deal | null>(null);

  async function load(q: string, s: number) {
    setLoading(true);
    const res = await fetch(`/api/deals?q=${encodeURIComponent(q)}&seed=${s}`);
    const data = await res.json();
    setDeals(data.deals);
    setUnderstood(data.parsed?.understood ?? []);
    setDataSource(data.dataSource);
    setLoading(false);
  }

  useEffect(() => {
    // Initial fetch on mount; defer so we don't setState synchronously in the effect body.
    const id = setTimeout(() => load("", seed), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runScan() {
    setScanning(true);
    const next = seed + 1;
    setSeed(next);
    setTimeout(() => {
      load(query, next).then(() => setScanning(false));
    }, 1400);
  }

  const visible = useMemo(
    () => (filter === "ALL" ? deals : deals.filter((d) => d.verdict === filter)),
    [deals, filter]
  );

  const stats = useMemo(() => {
    const buys = deals.filter((d) => d.verdict === "BUY");
    const avgRoi = deals.length ? deals.reduce((a, d) => a + d.roi, 0) / deals.length : 0;
    const profit = buys.reduce((a, d) => a + d.profit * Math.min(d.monthlySales, 30), 0);
    return { found: deals.length, buys: buys.length, avgRoi, profit };
  }, [deals]);

  return (
    <div className="flex min-h-screen">
      <Sidebar active="deals" />

      <main className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-30 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-3">
            <SearchBar value={query} onChange={setQuery} onSubmit={() => load(query, seed)} understood={understood} />
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
            >
              {scanning ? <Spinner /> : <Radar />}
              {scanning ? "Scanning…" : "Run Scan"}
            </button>
          </div>
        </header>

        <div className="px-5 py-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Deals found" value={String(stats.found)} sub="this scan" tone="#10d98e" icon="🎯" />
            <StatCard label="BUY signals" value={String(stats.buys)} sub="ready to source" tone="#84cc16" icon="✅" />
            <StatCard label="Avg ROI" value={`${stats.avgRoi.toFixed(0)}%`} sub="across all finds" tone="#f5a524" icon="📈" />
            <StatCard label="Est. monthly profit" value={usd(stats.profit)} sub="if you buy the winners" tone="#6366f1" icon="💰" />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-bg-card/60 px-4 py-2.5 text-[11px]">
            <div className="flex items-center gap-2 text-text-dim">
              <span className={`h-2 w-2 rounded-full ${dataSource === "mock" ? "bg-warn" : "bg-accent"}`} />
              {dataSource === "mock"
                ? "Demo mode — realistic mock data. Add a Keepa API key to source live deals."
                : "Live — powered by Keepa (Amazon US)."}
            </div>
            <span className="hidden text-text-faint sm:block">Marketplace: Amazon US · amazon.com</span>
          </div>

          {!query && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-text-faint">Try:</span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); load(s, seed); }}
                  className="rounded-full border border-border bg-white/5 px-3 py-1 text-[11px] text-text-dim transition hover:border-accent/40 hover:text-text"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <div className="flex gap-1 rounded-xl border border-border bg-bg-card/60 p-1">
              {(["ALL", "BUY", "WATCH", "PASS"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                    filter === f ? "bg-accent/15 text-accent" : "text-text-dim hover:text-text"
                  }`}
                >
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-text-faint">{visible.length} deals · sorted by ROI</span>
          </div>

          {loading ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          ) : visible.length === 0 ? (
            <Empty />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((d) => (
                <DealCard key={d.id} deal={d} onClick={() => setSelected(d)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {selected && <DealDetail deal={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SearchBar({
  value, onChange, onSubmit, understood,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; understood: string[];
}) {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-black/30 px-3.5 py-2.5 focus-within:border-accent/50">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10d98e" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 2.4l1.9 5.6L19.6 8l-4.6 3.5 1.7 5.8L12 14.4 7.3 17.3 9 11.5 4.4 8l5.7 0L12 2.4z" />
        </svg>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Describe the deals you want… e.g. ‘toys under $20 with 50% ROI, BSR under 100,000’"
          className="w-full bg-transparent text-[13px] text-text placeholder:text-text-faint outline-none"
        />
        {understood.length > 0 && (
          <div className="hidden shrink-0 items-center gap-1 md:flex">
            {understood.slice(0, 3).map((u) => (
              <span key={u} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">{u}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone, icon }: { label: string; value: string; sub: string; tone: string; icon: string }) {
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

function Skeleton() {
  return <div className="h-64 animate-pulse rounded-2xl border border-border bg-bg-card/40" />;
}

function Empty() {
  return (
    <div className="mt-10 grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
      <div className="text-3xl">🔍</div>
      <p className="mt-2 text-sm font-medium text-text">No deals match that brief</p>
      <p className="text-[12px] text-text-dim">Loosen your ROI/BSR criteria or run a fresh scan.</p>
    </div>
  );
}

function Radar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M19.07 4.93A10 10 0 1112 2v10l6 4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
