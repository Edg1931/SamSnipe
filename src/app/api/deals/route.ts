import { NextResponse } from "next/server";
import { generateDeals } from "@/lib/mockData";
import { applyQuery } from "@/lib/search";
import { parseBrief, aiEnabled } from "@/lib/ai";
import { KEEPA_LIVE } from "@/lib/keepa";

// GET /api/deals?q=...&seed=...&sites=walmart.com,target.com&ai=1
// AI parses the natural-language brief (with a rule-based fallback); deals come
// from the mock sourcing engine (Keepa-backed once live).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const seed = Number(searchParams.get("seed") ?? "7");
  const sitesParam = searchParams.get("sites") ?? "";
  const sites = sitesParam.split(",").map((s) => s.trim()).filter(Boolean);
  const aiSearch = searchParams.get("ai") !== "0";

  let deals = generateDeals(seed, 14, {
    sites: sites.length ? sites : undefined,
    aiSearch,
  });
  const parsed = await parseBrief(q);
  if (q.trim()) deals = applyQuery(deals, parsed);

  return NextResponse.json({
    deals,
    parsed,
    dataSource: KEEPA_LIVE ? "keepa-live" : "mock",
    ai: aiEnabled(),
  });
}
