import { NextResponse } from "next/server";
import { analyzeDeal } from "@/lib/ai";
import type { Deal } from "@/lib/types";

// POST /api/analyze  { deal }  → AI (or rule-based) Buy/Watch/Pass verdict.
export async function POST(req: Request) {
  try {
    const { deal } = (await req.json()) as { deal: Deal };
    if (!deal?.id) return NextResponse.json({ error: "Missing deal." }, { status: 400 });
    const result = await analyzeDeal(deal);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysis failed." },
      { status: 500 }
    );
  }
}
