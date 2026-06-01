"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Deal, Verdict } from "@/lib/types";
import { usd } from "@/lib/format";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { FindDeals } from "@/components/FindDeals";
import { ScanBarcode } from "@/components/ScanBarcode";
import { CommandCenter } from "@/components/CommandCenter";
import { DealCard } from "@/components/DealCard";
import { DealTable } from "@/components/DealTable";
import { DealDetail } from "@/components/DealDetail";
import { computeSurvival } from "@/lib/survival";
import { dealScore } from "@/lib/score";
import { assessTrust } from "@/lib/trust";
import { toast } from "@/lib/toast";
import { DealGridSkeleton } from "@/components/Skeleton";
import { SavedViews } from "@/components/SavedViews";
import { loadViews, saveViews, viewMatches, type SavedView } from "@/lib/views";
import { SourcesPanel } from "@/components/SourcesPanel";
import { ImportModal } from "@/components/ImportModal";
import { BrandsPanel } from "@/components/BrandsPanel";
import { BuyListPanel } from "@/components/BuyListPanel";
import { Copilot } from "@/components/Copilot";
import { ApprovalsPanel } from "@/components/ApprovalsPanel";
import { OptimizerModal } from "@/components/OptimizerModal";
import { ScanModal } from "@/components/ScanModal";
import { AutoPilotPanel } from "@/components/AutoPilotPanel";
import type { SavedSearch } from "@/lib/autopilot";
import { loadSearches, saveSearches } from "@/lib/autopilot";
import type { TargetSite } from "@/lib/sources";
import { DEFAULT_SITES, loadSources, saveSources, loadAiSearch, saveAiSearch } from "@/lib/sources";
import { loadExemptBrands, saveExemptBrands, isExempt } from "@/lib/brands";
import type { BuyItem } from "@/lib/buylist";
import { loadBuyList, saveBuyList, addToBuyList } from "@/lib/buylist";
import type { Approvals } from "@/lib/ungating";
import { loadApprovals, saveApprovals } from "@/lib/ungating";
import type { Decision } from "@/lib/taste";
import { loadDecisions, saveDecisions, recordDecision, buildProfile, scoreFit } from "@/lib/taste";

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
  const [discovering, setDiscovering] = useState(false);
  // Seed from the calendar day so the demo feed rotates daily (live Keepa data
  // refreshes on its own); a scan bumps it for a fresh set on demand.
  const [seed, setSeed] = useState(() => Math.floor(Date.now() / 86_400_000) % 100_000);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<Deal | null>(null);

  const router = useRouter();
  // Home vs feed, feed controls: filters, view density, pagination.
  const PAGE = 24;
  const [mode, setMode] = useState<"home" | "feed">("home");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [showFilters, setShowFilters] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [findingsCount, setFindingsCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [crit, setCrit] = useState({ minRoi: 0, maxBsr: 0, maxCost: 0, minSurvival: 0, minSold: 0, category: "" });

  // Targeted sources + AI web search + spreadsheet imports.
  const [sites, setSites] = useState<TargetSite[]>(DEFAULT_SITES);
  const [aiSearch, setAiSearch] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [imported, setImported] = useState<Deal[]>([]);

  // Brand exemptions + feed organization.
  const [exemptBrands, setExemptBrands] = useState<string[]>([]);
  const [showBrands, setShowBrands] = useState(false);
  const [groupBy, setGroupBy] = useState<"none" | "source">("none");

  // Buy list, copilot, AI status, and learned Buy/Pass decisions.
  const [buyList, setBuyList] = useState<BuyItem[]>([]);
  const [showBuyList, setShowBuyList] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [keepaKey, setKeepaKey] = useState(false);
  const [bought, setBought] = useState<string[]>([]);
  const [passed, setPassed] = useState<string[]>([]);

  // Ungating approvals (#3), taste decisions (#5), optimizer (#9), shelf scan (#10).
  const [approvals, setApprovals] = useState<Approvals>({ brands: [], categories: [] });
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [sortMode, setSortMode] = useState<"score" | "roi" | "foryou">("score");
  const [showApprovals, setShowApprovals] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [showAutoPilot, setShowAutoPilot] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);

  async function load(q: string, s: number, opts?: { sites?: TargetSite[]; ai?: boolean }) {
    setLoading(true);
    setShown(PAGE);
    try {
      const activeSites = (opts?.sites ?? sites).filter((x) => x.enabled).map((x) => x.domain);
      const ai = (opts?.ai ?? aiSearch) ? "1" : "0";
      const params = new URLSearchParams({ q, seed: String(s), sites: activeSites.join(","), ai });
      const res = await fetch(`/api/deals?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      // Defensive: never let a bad response put non-arrays into state (which
      // would throw on every subsequent render and kill all interactivity).
      setDeals(Array.isArray(data.deals) ? data.deals : []);
      setUnderstood(Array.isArray(data.parsed?.understood) ? data.parsed.understood : []);
      setDataSource(data.dataSource ?? "mock");
      setAiOn(Boolean(data.ai));
      setKeepaKey(Boolean(data.keepaKey));
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Hydrate saved sources/AI preference, then do the initial fetch. Deferred
    // so we don't setState synchronously in the effect body.
    const s = loadSources();
    const ai = loadAiSearch();
    const eb = loadExemptBrands();
    const bl = loadBuyList();
    const ap = loadApprovals();
    const dec = loadDecisions();
    const sx = loadSearches();
    const vw = loadViews();
    const id = setTimeout(() => {
      setViews(vw);
      setSites(s);
      setAiSearch(ai);
      setExemptBrands(eb);
      setBuyList(bl);
      setApprovals(ap);
      setDecisions(dec);
      setSearches(sx);
      load("", seed, { sites: s, ai });
      // Auto-Pilot findings count for the home callout + nav badge.
      fetch("/api/autopilot/findings")
        .then((r) => r.json())
        .then((d) => setFindingsCount(Array.isArray(d.inbox) ? d.inbox.length : 0))
        .catch(() => {});
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateApprovals(a: Approvals) {
    setApprovals(a);
    saveApprovals(a);
  }
  function updateSearches(s: SavedSearch[]) {
    setSearches(s);
    saveSearches(s);
  }

  // Saved views — snapshot/restore the feed's filter + sort lens.
  const viewSnapshot = () => ({ filter, sortMode, verifiedOnly, crit });
  function applyView(v: SavedView) {
    setFilter(v.filter as Filter);
    setSortMode(v.sortMode as "score" | "roi" | "foryou");
    setVerifiedOnly(v.verifiedOnly);
    setCrit(v.crit);
    setShown(PAGE);
    toast.info(`View “${v.name}” applied`);
  }
  function saveView(name: string) {
    const v: SavedView = { id: Date.now().toString(36), name, ...viewSnapshot() };
    const next = [...views.filter((x) => x.name !== name), v];
    setViews(next); saveViews(next);
    toast.success(`Saved view “${name}”`);
  }
  function deleteView(id: string) {
    const next = views.filter((v) => v.id !== id);
    setViews(next); saveViews(next);
  }
  // Single entry point for sidebar + bottom nav — close everything, then route.
  function navigate(key: string) {
    setShowSources(false); setShowBrands(false); setShowImport(false);
    setShowBuyList(false); setShowCopilot(false); setShowApprovals(false);
    setShowOptimizer(false); setShowScan(false); setShowAutoPilot(false); setShowBarcode(false);
    setSelected(null);
    if (key === "setup") { router.push("/setup"); return; }
    if (key === "home") setMode("home");
    else if (key === "deals" || key === "feed") setMode("feed");
    else if (key === "autopilot") setShowAutoPilot(true);
    else if (key === "optimizer") setShowOptimizer(true);
    else if (key === "buylist") setShowBuyList(true);
    else if (key === "copilot") setShowCopilot(true);
    else if (key === "scan") setShowScan(true);
    else if (key === "barcode") setShowBarcode(true);
    else if (key === "sources") setShowSources(true);
    else if (key === "approvals") setShowApprovals(true);
    else if (key === "brands") setShowBrands(true);
    else if (key === "import") setShowImport(true);
  }
  function runWatch(q: string) {
    setQuery(q);
    setShowAutoPilot(false);
    load(q, seed);
  }
  function record(deal: Deal, action: "buy" | "pass") {
    const next = recordDecision(decisions, deal, action);
    setDecisions(next);
    saveDecisions(next);
  }

  function updateBuyList(next: BuyItem[]) {
    setBuyList(next);
    saveBuyList(next);
  }
  function handleAddToBuyList(deal: Deal) {
    updateBuyList(addToBuyList(buyList, deal));
    setBought((b) => (b.includes(deal.title) ? b : [...b, deal.title]));
    record(deal, "buy");
    setSelected(null);
    toast.success(`Added “${deal.title}” to your buy list`);
  }
  function handlePass(deal: Deal) {
    setPassed((p) => (p.includes(deal.title) ? p : [...p, deal.title]));
    record(deal, "pass");
    setSelected(null);
    toast.info(`Passed on “${deal.title}” — tuning your For You feed`);
  }
  function handleAddBasket(picks: { deal: Deal; qty: number }[]) {
    let next = buyList;
    for (const { deal, qty } of picks) next = addToBuyList(next, deal, qty);
    updateBuyList(next);
    picks.forEach(({ deal }) => record(deal, "buy"));
    const units = picks.reduce((a, p) => a + p.qty, 0);
    toast.success(`Added ${picks.length} product${picks.length === 1 ? "" : "s"} (${units} units) to your buy list`);
  }

  function updateBrands(next: string[]) {
    setExemptBrands(next);
    saveExemptBrands(next);
  }
  function handleExemptBrand(brand: string) {
    if (!exemptBrands.some((b) => b.toLowerCase() === brand.toLowerCase())) {
      updateBrands([...exemptBrands, brand].sort((a, b) => a.localeCompare(b)));
      toast.info(`Hiding ${brand} deals — manage in Brands`);
    }
  }

  function updateSites(next: TargetSite[]) {
    setSites(next);
    saveSources(next);
  }
  function updateAi(on: boolean) {
    setAiSearch(on);
    saveAiSearch(on);
  }

  // AI searches the open web for deals, resolves them to ASINs via Keepa, and
  // blends the results into the feed.
  async function discover() {
    setDiscovering(true);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: query,
          // Saved searches you're hunting + your tracked sources steer the AI.
          targets: searches.filter((s) => s.enabled).map((s) => s.query).filter(Boolean),
          sites: sites.filter((s) => s.enabled).map((s) => s.domain),
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.deals) && data.deals.length > 0) {
        setImported((prev) => [...data.deals, ...prev]);
        setShown(PAGE);
        toast.success(`AI Discover found ${data.deals.length} new deal${data.deals.length === 1 ? "" : "s"}`);
      } else {
        toast.info(data.message || "AI Discover found no new deals this time");
      }
    } catch {
      toast.error("AI Discover failed — try again in a moment");
    } finally {
      setDiscovering(false);
    }
  }

  function runScan() {
    setScanning(true);
    const next = seed + 1;
    setSeed(next);
    setTimeout(() => {
      load(query, next).then(() => { setScanning(false); toast.success("Scan complete — feed refreshed"); });
    }, 1400);
  }
  function findBoth() { discover(); runScan(); }

  // Imported rows live alongside scanned deals; combined feed is ROI-ranked and
  // de-duplicated (by ASIN, else title+source) so the same product never shows
  // twice — keeping the highest-ROI instance.
  const combined = useMemo(() => {
    const sorted = [...imported, ...deals].sort((a, b) => b.roi - a.roi);
    const seen = new Set<string>();
    const out: Deal[] = [];
    for (const d of sorted) {
      const key =
        d.match.asin && d.match.asin !== "—"
          ? `asin:${d.match.asin}`
          : `t:${d.title.trim().toLowerCase()}|${d.source.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
    return out;
  }, [imported, deals]);

  // Drop any deal whose brand is on the exemption blocklist.
  const allDeals = useMemo(
    () => combined.filter((d) => !isExempt(d.brand, exemptBrands)),
    [combined, exemptBrands]
  );
  const hiddenByBrand = combined.length - allDeals.length;

  const tasteProfile = useMemo(() => buildProfile(decisions), [decisions]);

  // Apply the filter rail to the brand-cleaned feed.
  const filteredDeals = useMemo(() => {
    return allDeals.filter((d) => {
      if (verifiedOnly && assessTrust(d).level !== "verified") return false;
      if (crit.minRoi && d.roi < crit.minRoi) return false;
      if (crit.maxBsr && d.bsr > crit.maxBsr) return false;
      if (crit.maxCost && d.sourcePrice > crit.maxCost) return false;
      if (crit.minSold && d.monthlySales < crit.minSold) return false;
      if (crit.category && d.category !== crit.category) return false;
      if (crit.minSurvival && computeSurvival(d).score < crit.minSurvival) return false;
      return true;
    });
  }, [allDeals, crit, verifiedOnly]);

  const visible = useMemo(() => {
    let list = filter === "ALL" ? filteredDeals : filteredDeals.filter((d) => d.verdict === filter);
    if (sortMode === "foryou") list = [...list].sort((a, b) => scoreFit(b, tasteProfile) - scoreFit(a, tasteProfile));
    else if (sortMode === "score") list = [...list].sort((a, b) => dealScore(b).score - dealScore(a).score);
    else list = [...list].sort((a, b) => b.roi - a.roi);
    return list;
  }, [filteredDeals, filter, sortMode, tasteProfile]);

  const visiblePage = useMemo(() => visible.slice(0, shown), [visible, shown]);

  const activeFilters =
    (crit.minRoi ? 1 : 0) + (crit.maxBsr ? 1 : 0) + (crit.maxCost ? 1 : 0) +
    (crit.minSurvival ? 1 : 0) + (crit.minSold ? 1 : 0) + (crit.category ? 1 : 0) +
    (verifiedOnly ? 1 : 0);

  // Group the visible deals by source/website when requested.
  const grouped = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const d of visiblePage) {
      const arr = map.get(d.source) ?? [];
      arr.push(d);
      map.set(d.source, arr);
    }
    // Sections ordered by deal count, then best ROI within each.
    return [...map.entries()]
      .map(([source, items]) => ({
        source,
        origin: items[0].origin,
        items: items.sort((a, b) => b.roi - a.roi),
        avgRoi: items.reduce((a, d) => a + d.roi, 0) / items.length,
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [visiblePage]);

  // Brands present in the feed, used to power quick-add chips in the panel.
  const feedBrands = useMemo(
    () => [...new Set(combined.map((d) => d.brand))].sort((a, b) => a.localeCompare(b)),
    [combined]
  );

  const stats = useMemo(() => {
    const buys = allDeals.filter((d) => d.verdict === "BUY");
    const avgRoi = allDeals.length ? allDeals.reduce((a, d) => a + d.roi, 0) / allDeals.length : 0;
    const profit = buys.reduce((a, d) => a + d.profit * Math.min(d.monthlySales, 30), 0);
    return { found: allDeals.length, buys: buys.length, avgRoi, profit };
  }, [allDeals]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        active={mode === "home" ? "home" : "deals"}
        onNavigate={navigate}
        badges={{
          buylist: buyList.length,
          autopilot: searches.filter((s) => s.enabled).length,
          approvals: approvals.brands.length + approvals.categories.length,
          brands: exemptBrands.length,
          sources: sites.filter((s) => s.enabled).length + (aiSearch ? 1 : 0),
        }}
      />

      <main className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-30 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <SearchBar value={query} onChange={setQuery} onSubmit={() => load(query, seed)} understood={understood} />
            <FindDeals
              scanning={scanning} discovering={discovering} aiOn={aiOn}
              onScan={runScan} onDiscover={discover} onBoth={findBoth}
            />
          </div>

          {/* Tool toolbar — mobile only; desktop uses the sidebar */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 lg:hidden">
            <Tool onClick={() => setShowAutoPilot(true)} icon={<BoltIcon />} label="Auto-Pilot" badge={searches.filter((s) => s.enabled).length || undefined} />
            <Tool onClick={() => setShowSources(true)} icon={<GlobeIcon />} label="Sources" badge={String(sites.filter((s) => s.enabled).length + (aiSearch ? 1 : 0))} />
            <Tool onClick={() => setShowApprovals(true)} icon={<KeyIcon />} label="Approvals" badge={approvals.brands.length + approvals.categories.length || undefined} />
            <Tool onClick={() => setShowBrands(true)} icon={<TagIcon />} label="Exempt" badge={exemptBrands.length || undefined} danger />
            <Tool onClick={() => setShowImport(true)} icon={<UploadIcon />} label="Import / Manifest" />
            <Tool onClick={() => setShowScan(true)} icon={<CameraIcon />} label="Shelf Scan" />
            <Tool onClick={() => setShowBarcode(true)} icon={<BarcodeIcon />} label="Scan Barcode" />
            <Tool onClick={() => setShowOptimizer(true)} icon={<ChartIcon />} label="Optimizer" />
            <Tool onClick={() => setShowBuyList(true)} icon={<CartIcon />} label="Buy List" badge={buyList.length || undefined} />
          </div>
        </header>

        {dataSource === "mock" && !bannerDismissed && (
          <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-[12px]">
            <span className="flex min-w-0 items-center gap-2 text-text">
              <span className="h-2 w-2 shrink-0 rounded-full bg-warn" />
              <span className="truncate">
                <span className="font-semibold">Demo data</span> — connect Keepa to source live Amazon deals.
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <button onClick={() => router.push("/setup")} className="font-medium text-accent hover:underline">Open Setup →</button>
              <button onClick={() => setBannerDismissed(true)} className="text-text-faint hover:text-text" aria-label="Dismiss">✕</button>
            </span>
          </div>
        )}

        {mode === "home" ? (
          <CommandCenter
            loading={loading}
            deals={allDeals}
            dataSource={dataSource}
            findingsCount={findingsCount}
            onOpenDeal={setSelected}
            onSeeAll={() => setMode("feed")}
            onOpenAutoPilot={() => navigate("autopilot")}
          />
        ) : (
        <div className="px-5 py-5 pb-24 lg:pb-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Deals found" value={String(stats.found)} sub="this scan" tone="#10d98e" icon="🎯" />
            <StatCard label="BUY signals" value={String(stats.buys)} sub="ready to source" tone="#84cc16" icon="✅" />
            <StatCard label="Avg ROI" value={`${stats.avgRoi.toFixed(0)}%`} sub="across all finds" tone="#f5a524" icon="📈" />
            <StatCard label="Est. monthly profit" value={usd(stats.profit)} sub="if you buy the winners" tone="#6366f1" icon="💰" />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-bg-card/60 px-4 py-2.5 text-[11px]">
            <div className="flex items-center gap-2 text-text-dim">
              <span className={`h-2 w-2 rounded-full ${dataSource === "mock" ? "bg-warn" : "bg-accent"}`} />
              {dataSource !== "mock" ? (
                "Live — powered by Keepa (Amazon US)."
              ) : keepaKey ? (
                <>Keepa key detected but no live deals came back —{" "}
                  <a href="/api/keepa-status" target="_blank" rel="noopener noreferrer" className="text-accent underline">run diagnostics</a>.</>
              ) : (
                "Demo mode — realistic mock data. Add a Keepa API key to source live deals."
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-text-faint">
                <span className={`h-2 w-2 rounded-full ${aiOn ? "bg-accent" : "bg-text-faint"}`} />
                AI {aiOn ? "on (Claude)" : "fallback"}
              </span>
              <span className="hidden text-text-faint sm:block">Amazon US · amazon.com</span>
            </div>
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

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
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
              <div className="flex gap-1 rounded-xl border border-border bg-bg-card/60 p-1">
                <span className="px-2 py-1.5 text-[11px] text-text-faint">Sort</span>
                {([["score", "Deal Score"], ["roi", "Top ROI"], ["foryou", "For You"]] as const).map(([m, lbl]) => (
                  <button
                    key={m}
                    onClick={() => { setSortMode(m); setShown(PAGE); }}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                      sortMode === m ? "bg-accent/15 text-accent" : "text-text-dim hover:text-text"
                    }`}
                    title={m === "foryou" ? (tasteProfile.hasData ? `Learned from ${tasteProfile.buys} buys / ${tasteProfile.passes} passes` : "Buy or pass a few deals to train this") : undefined}
                  >
                    {lbl}{m === "foryou" && tasteProfile.hasData ? " ✨" : ""}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-xl border border-border bg-bg-card/60 p-1">
                <span className="px-2 py-1.5 text-[11px] text-text-faint">View</span>
                {(["cards", "table"] as const).map((vw) => (
                  <button
                    key={vw}
                    onClick={() => setView(vw)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition ${
                      view === vw ? "bg-accent/15 text-accent" : "text-text-dim hover:text-text"
                    }`}
                  >
                    {vw}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition ${
                  showFilters || activeFilters ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-bg-card/60 text-text-dim hover:text-text"
                }`}
              >
                Filters{activeFilters ? ` · ${activeFilters}` : ""}
              </button>
              <div className="flex gap-1 rounded-xl border border-border bg-bg-card/60 p-1">
                <span className="px-2 py-1.5 text-[11px] text-text-faint">Group</span>
                {(["none", "source"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                      groupBy === g ? "bg-accent/15 text-accent" : "text-text-dim hover:text-text"
                    }`}
                  >
                    {g === "none" ? "Flat" : "By source"}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-text-faint">
              {visible.length} deals · {sortMode === "score" ? "by Deal Score" : sortMode === "foryou" ? "for you" : "by ROI"}
              {hiddenByBrand > 0 && <span className="text-[#f88aa1]"> · {hiddenByBrand} hidden by brand</span>}
            </span>
          </div>

          {/* Quick filters — one-tap presets over the full filter rail */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-text-faint">Quick:</span>
            {[
              { label: "BUY only", active: filter === "BUY", on: () => setFilter(filter === "BUY" ? "ALL" : "BUY") },
              { label: "ROI ≥ 40%", active: crit.minRoi >= 40, on: () => { setCrit((c) => ({ ...c, minRoi: c.minRoi >= 40 ? 0 : 40 })); setShown(PAGE); } },
              { label: "Verified", active: verifiedOnly, on: () => { setVerifiedOnly((v) => !v); setShown(PAGE); } },
              { label: "Safe 60+", active: crit.minSurvival >= 60, on: () => { setCrit((c) => ({ ...c, minSurvival: c.minSurvival >= 60 ? 0 : 60 })); setShown(PAGE); } },
              { label: "Under $25", active: crit.maxCost > 0 && crit.maxCost <= 25, on: () => { setCrit((c) => ({ ...c, maxCost: c.maxCost > 0 && c.maxCost <= 25 ? 0 : 25 })); setShown(PAGE); } },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={chip.on}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                  chip.active ? "border-accent/50 bg-accent/15 text-accent" : "border-border bg-white/5 text-text-dim hover:text-text"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <SavedViews
            views={views}
            isActive={(v) => viewMatches(v, viewSnapshot())}
            onApply={applyView}
            onSave={saveView}
            onDelete={deleteView}
          />

          {/* Filter rail */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-border bg-bg-card/60 p-3 sm:grid-cols-3 lg:grid-cols-6">
              <FilterNum label="Min ROI %" value={crit.minRoi} onChange={(v) => { setCrit((c) => ({ ...c, minRoi: v })); setShown(PAGE); }} />
              <FilterNum label="Max BSR" value={crit.maxBsr} onChange={(v) => { setCrit((c) => ({ ...c, maxBsr: v })); setShown(PAGE); }} />
              <FilterNum label="Max cost $" value={crit.maxCost} onChange={(v) => { setCrit((c) => ({ ...c, maxCost: v })); setShown(PAGE); }} />
              <FilterNum label="Min safety" value={crit.minSurvival} onChange={(v) => { setCrit((c) => ({ ...c, minSurvival: v })); setShown(PAGE); }} />
              <FilterNum label="Min sold/mo" value={crit.minSold} onChange={(v) => { setCrit((c) => ({ ...c, minSold: v })); setShown(PAGE); }} />
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-text-faint">Category</span>
                <select
                  value={crit.category}
                  onChange={(e) => { setCrit((c) => ({ ...c, category: e.target.value })); setShown(PAGE); }}
                  className="mt-1 w-full rounded-lg border border-border bg-black/30 px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent/50"
                >
                  <option value="">All</option>
                  {["Toys", "Electronics", "Home & Kitchen", "Sports & Outdoors", "Beauty", "Health & Household", "Tools & Home Improvement"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-1.5 text-[12px] text-text-dim">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => { setVerifiedOnly(e.target.checked); setShown(PAGE); }}
                  className="accent-[#10d98e]"
                />
                Keepa-verified only
              </label>
              {activeFilters > 0 && (
                <button
                  onClick={() => { setCrit({ minRoi: 0, maxBsr: 0, maxCost: 0, minSurvival: 0, minSold: 0, category: "" }); setVerifiedOnly(false); setShown(PAGE); }}
                  className="col-span-2 self-end rounded-lg border border-border bg-white/5 py-1.5 text-[12px] text-text-dim hover:text-text sm:col-span-1"
                >
                  Reset filters
                </button>
              )}
            </div>
          )}

          {loading ? (
            <DealGridSkeleton />
          ) : visible.length === 0 ? (
            <Empty />
          ) : view === "table" ? (
            <DealTable deals={visiblePage} onOpen={setSelected} />
          ) : groupBy === "source" ? (
            <div className="mt-4 space-y-6">
              {grouped.map((g) => (
                <section key={g.source}>
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-[11px] font-bold text-text-dim">
                      {g.source.replace(/^www\./, "").slice(0, 2).toUpperCase()}
                    </span>
                    <h3 className="text-[13px] font-semibold text-text">{g.source}</h3>
                    {g.origin !== "scan" && (
                      <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-text-faint">
                        {g.origin === "import" ? "Imported" : "Web"}
                      </span>
                    )}
                    <span className="text-[11px] text-text-faint">
                      {g.items.length} deal{g.items.length === 1 ? "" : "s"} · {g.avgRoi.toFixed(0)}% avg ROI
                    </span>
                    <div className="ml-1 h-px flex-1 bg-border" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {g.items.map((d) => (
                      <DealCard key={d.id} deal={d} onClick={() => setSelected(d)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visiblePage.map((d) => (
                <DealCard key={d.id} deal={d} onClick={() => setSelected(d)} />
              ))}
            </div>
          )}

          {/* Load more */}
          {!loading && visiblePage.length < visible.length && (
            <div className="mt-5 text-center">
              <button
                onClick={() => setShown((n) => n + PAGE)}
                className="rounded-xl border border-border bg-white/5 px-5 py-2.5 text-[13px] font-medium text-text hover:bg-white/10"
              >
                Load more · {visible.length - visiblePage.length} remaining
              </button>
            </div>
          )}
        </div>
        )}
      </main>

      {selected && (
        <DealDetail
          deal={selected}
          inBuyList={buyList.some((i) => i.deal.id === selected.id)}
          exempted={isExempt(selected.brand, exemptBrands)}
          approvals={approvals}
          onClose={() => setSelected(null)}
          onAddToBuyList={handleAddToBuyList}
          onPass={handlePass}
          onExemptBrand={handleExemptBrand}
        />
      )}

      {showBuyList && (
        <BuyListPanel items={buyList} onChange={updateBuyList} onClose={() => setShowBuyList(false)} />
      )}

      {showCopilot && (
        <Copilot
          deals={allDeals}
          decisions={{ bought, passed }}
          aiOn={aiOn}
          onClose={() => setShowCopilot(false)}
        />
      )}

      {showSources && (
        <SourcesPanel
          sites={sites}
          aiSearch={aiSearch}
          onChange={updateSites}
          onAiChange={updateAi}
          onClose={() => setShowSources(false)}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={(d) => setImported((prev) => [...d, ...prev])}
        />
      )}

      {showBrands && (
        <BrandsPanel
          brands={exemptBrands}
          suggestions={feedBrands}
          onChange={updateBrands}
          onClose={() => setShowBrands(false)}
        />
      )}

      {showApprovals && (
        <ApprovalsPanel approvals={approvals} onChange={updateApprovals} onClose={() => setShowApprovals(false)} />
      )}

      {showOptimizer && (
        <OptimizerModal deals={allDeals} onAddBasket={handleAddBasket} onClose={() => setShowOptimizer(false)} />
      )}

      {showScan && <ScanModal aiOn={aiOn} onClose={() => setShowScan(false)} />}
      {showBarcode && <ScanBarcode onClose={() => setShowBarcode(false)} onResult={(d) => { setShowBarcode(false); setSelected(d); }} />}

      {showAutoPilot && (
        <AutoPilotPanel
          searches={searches}
          deals={allDeals}
          onChange={updateSearches}
          onRun={runWatch}
          onClose={() => setShowAutoPilot(false)}
          onAddFindings={(d) => { setImported((prev) => [...d, ...prev]); setShown(PAGE); toast.success(`Added ${d.length} find${d.length === 1 ? "" : "s"} to your feed`); }}
        />
      )}

      <BottomNav mode={mode} findingsCount={findingsCount} onNavigate={navigate} />

      {/* Copilot — floating assistant (kept out of the toolbars) */}
      {!showCopilot && (
        <button
          onClick={() => setShowCopilot(true)}
          title="Chat with your AI sourcing copilot"
          aria-label="Open Copilot"
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-[13px] font-semibold text-white shadow-2xl transition hover:bg-primary-dim lg:bottom-6 lg:right-6"
        >
          <SparkIcon />
          <span className="hidden sm:inline">Copilot</span>
        </button>
      )}
    </div>
  );
}

function Tool({
  onClick, icon, label, badge, danger,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: string | number;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-white/5 px-2.5 py-1.5 text-[12px] font-medium text-text-dim transition hover:bg-white/10 hover:text-text"
      title={label}
    >
      {icon}
      <span>{label}</span>
      {badge != null && (
        <span className={`rounded-md px-1.5 text-[10px] font-semibold ${danger ? "bg-danger/15 text-[#f88aa1]" : "bg-accent/15 text-accent"}`}>{badge}</span>
      )}
    </button>
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

function FilterNum({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-text-faint">{label}</span>
      <input
        type="number"
        value={value || ""}
        placeholder="any"
        onChange={(e) => onChange(Math.max(0, +e.target.value || 0))}
        className="mt-1 w-full rounded-lg border border-border bg-black/30 px-2 py-1.5 text-[12px] text-text placeholder:text-text-faint outline-none focus:border-accent/50"
      />
    </label>
  );
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

function BarcodeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7.2-7.2a2 2 0 01-.6-1.4V4a2 2 0 012-2h8a2 2 0 011.4.6l6.4 6.4a2 2 0 010 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L19 4m-3 0h3v3" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h3l2-2h8l2 2h3v12H3z" /><circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18M7 14l3-4 3 3 4-6" />
    </svg>
  );
}

