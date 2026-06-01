import { NextResponse } from "next/server";
import { spApiEnabled, getEconomics } from "@/lib/spapi";

// POST /api/spapi { asin, price } → real Amazon economics (fees, Buy Box, gating)
// when SP-API is configured; otherwise { configured: false } so the UI falls back.
export async function POST(req: Request) {
  if (!spApiEnabled()) return NextResponse.json({ configured: false });
  try {
    const { asin, price } = (await req.json()) as { asin?: string; price?: number };
    if (!asin || asin === "—") return NextResponse.json({ configured: true, fees: null, buyBox: null, gating: null });
    const econ = await getEconomics(asin, Number(price) || 0);
    return NextResponse.json({ configured: true, ...econ });
  } catch (e) {
    return NextResponse.json({ configured: true, error: e instanceof Error ? e.message : "SP-API lookup failed" }, { status: 500 });
  }
}
