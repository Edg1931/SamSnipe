import { NextResponse } from "next/server";
import { generateDeals } from "@/lib/mockData";
import { applyQuery } from "@/lib/search";
import { parseBrief, aiEnabled } from "@/lib/ai";
import { KEEPA_LIVE, KEEPA_KEY_PRESENT, liveDeals } from "@/lib/keepa";
import { applyLiveCosts, retailLive } from "@/lib/retail";
import type { Deal } from "@/lib/types";

// How many top deals get a real live retailer-price lookup per feed load.
const RETAIL_LOOKUPS = Math.max(0, Math.min(40, Number(process.env.SAMSNIPE_RETAIL_LOOKUPS || "10")));

// GET /api/deals?q=...&seed=...&sites=walmart.com,target.com&ai=1
// Live Keepa data when configured (with mock fallback); AI parses the brief.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const seed = Number(searchParams.get("seed") ?? "7");
  const sitesParam = searchParams.get("sites") ?? "";
  const sites = sitesParam.split(",").map((s) => s.trim()).filter(Boolean);
  const aiSearch = searchParams.get("ai") !== "0";

  // Prefer live Keepa; fall back to the mock engine if it's off or returns nothing.
  let deals: Deal[] = [];
  let source: "keepa-live" | "mock" = "mock";
  if (KEEPA_LIVE) {
    deals = await liveDeals(); // pulls up to SAMSNIPE_DEAL_LIMIT (default 50)
    if (deals.length > 0) source = "keepa-live";
  }
  if (deals.length === 0) {
    deals = generateDeals(seed, 24, {
      sites: sites.length ? sites : undefined,
      aiSearch,
    });
  }

  const parsed = await parseBrief(q);
  if (q.trim()) deals = applyQuery(deals, parsed);

  // Rewrite the top deals' cost/ROI with real retailer prices (SerpApi) so the
  // headline numbers reflect what you can actually buy it for.
  deals = await applyLiveCosts(deals, RETAIL_LOOKUPS);

  return NextResponse.json({
    deals,
    parsed,
    dataSource: source,
    ai: aiEnabled(),
    keepaKey: KEEPA_KEY_PRESENT,
    keepaLive: KEEPA_LIVE,
    retailLive: retailLive(),
  });
}
