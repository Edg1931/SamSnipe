import { NextResponse } from "next/server";
import { getRetailOffers, type RetailQuery } from "@/lib/retail";

// POST /api/retail  { title, brand?, asin?, reference? }
// Returns retailer price offers (live via SerpApi when configured, else mock).
export async function POST(req: Request) {
  try {
    const q = (await req.json()) as RetailQuery;
    if (!q?.title) return NextResponse.json({ error: "Missing product title." }, { status: 400 });
    const result = await getRetailOffers(q);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Retail lookup failed." },
      { status: 500 }
    );
  }
}
