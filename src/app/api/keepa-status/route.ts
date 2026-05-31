import { NextResponse } from "next/server";
import { keepaStatus } from "@/lib/keepa";

// GET /api/keepa-status — diagnostic: is the Keepa key set, valid, and serving
// live data? Open this on the deployed site to see exactly what's wrong.
export async function GET() {
  try {
    const status = await keepaStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "status check failed" },
      { status: 500 }
    );
  }
}
