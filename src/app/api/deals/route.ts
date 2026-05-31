import { NextResponse } from "next/server";
import { generateDeals } from "@/lib/mockData";
import { parseQuery, applyQuery } from "@/lib/search";
import { KEEPA_LIVE } from "@/lib/keepa";

// GET /api/deals?q=...&seed=...
// Returns deals from the mock sourcing engine (Keepa-backed once live).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const seed = Number(searchParams.get("seed") ?? "7");

  let deals = generateDeals(seed, 14);
  const parsed = parseQuery(q);
  if (q.trim()) deals = applyQuery(deals, parsed);

  return NextResponse.json({
    deals,
    parsed,
    dataSource: KEEPA_LIVE ? "keepa-live" : "mock",
  });
}
