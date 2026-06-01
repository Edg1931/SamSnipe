import { NextResponse } from "next/server";
import { discoverDeals, aiEnabled } from "@/lib/ai";
import { resolveCandidates } from "@/lib/keepa";

// POST /api/discover { brief? }
// AI searches the open web for real retail deals, then resolves each to an ASIN
// via Keepa and returns analyzed Deals. Buy-side price/URL are real (from the
// web); Amazon sell-side comes from Keepa when the key is working.
export async function POST(req: Request) {
  try {
    const { brief, targets, sites } = (await req.json().catch(() => ({}))) as
      { brief?: string; targets?: string[]; sites?: string[] };
    if (!aiEnabled()) {
      return NextResponse.json({
        deals: [],
        source: "offline",
        message: "Add ANTHROPIC_API_KEY to enable AI web-search discovery.",
      });
    }
    const { candidates, source } = await discoverDeals({ brief, targets, sites });
    if (candidates.length === 0) {
      return NextResponse.json({ deals: [], source, message: "No web deals found this pass — try again or refine the brief." });
    }
    const deals = await resolveCandidates(candidates);
    return NextResponse.json({ deals, source, found: candidates.length });
  } catch (e) {
    return NextResponse.json(
      { deals: [], error: e instanceof Error ? e.message : "Discovery failed." },
      { status: 500 }
    );
  }
}
