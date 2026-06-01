import { NextResponse } from "next/server";
import { resolveCandidates } from "@/lib/keepa";
import type { DiscoveredDeal } from "@/lib/types";

// POST /api/barcode { code, cost? } — resolve a scanned UPC/EAN to a real
// Amazon deal. Resolution goes SP-API-first (catalog by UPC = token-free), then
// Keepa. Returns { found, deal } so the app can open it for an instant verdict.
export async function POST(req: Request) {
  try {
    const { code, cost } = (await req.json()) as { code?: string; cost?: number };
    const upc = (code ?? "").replace(/\D/g, "");
    if (upc.length < 8) return NextResponse.json({ found: false, message: "That doesn't look like a valid barcode." });

    const candidate: DiscoveredDeal = {
      title: upc, brand: "", retailer: "In-store",
      sourcePrice: cost && cost > 0 ? cost : 1,
      sourceUrl: "", category: "", upc,
    };
    const [deal] = await resolveCandidates([candidate]);
    if (!deal || deal.match.asin === "—") {
      return NextResponse.json({ found: false, message: "No live Amazon match for that barcode — it may be out of stock or not sold on Amazon." });
    }
    return NextResponse.json({ found: true, deal });
  } catch (e) {
    return NextResponse.json({ found: false, message: e instanceof Error ? e.message : "Lookup failed." }, { status: 500 });
  }
}
