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

    // Multi-pass: one broad sweep (brief + all targets + sites) plus a dedicated,
    // deeper pass per saved target so the things you're hunting get real coverage.
    const targetList = (targets ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 5);
    const passes = [discoverDeals({ brief, targets, sites }), ...targetList.map((t) => discoverDeals({ brief: t, sites }))];
    const results = await Promise.all(passes);

    // Aggregate + dedupe across passes (by UPC, else title).
    const seen = new Set<string>();
    const candidates = [];
    for (const r of results) {
      for (const c of r.candidates) {
        const key = (c.upc || c.title).trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        candidates.push(c);
      }
    }
    if (candidates.length === 0) {
      return NextResponse.json({ deals: [], source: "ai", message: "No web deals found this pass — try again or refine the brief." });
    }
    // Resolve (SP-API first = no Keepa tokens). Cap to keep latency/limits sane.
    const deals = await resolveCandidates(candidates.slice(0, 30));
    return NextResponse.json({ deals, source: "ai", found: candidates.length, passes: passes.length });
  } catch (e) {
    return NextResponse.json(
      { deals: [], error: e instanceof Error ? e.message : "Discovery failed." },
      { status: 500 }
    );
  }
}
