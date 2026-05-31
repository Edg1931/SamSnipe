import { NextResponse } from "next/server";
import { getJSON, setJSON, storeConfigured, K } from "@/lib/store";
import type { SavedSearch } from "@/lib/autopilot";

// Server-side watch storage so the scheduled cron knows what to hunt for.
export async function GET() {
  const watches = await getJSON<SavedSearch[]>(K.watches, []);
  return NextResponse.json({ watches, storeConfigured });
}

export async function POST(req: Request) {
  try {
    const { searches } = (await req.json()) as { searches: SavedSearch[] };
    if (!Array.isArray(searches)) return NextResponse.json({ error: "searches must be an array" }, { status: 400 });
    await setJSON(K.watches, searches);
    return NextResponse.json({ ok: true, storeConfigured });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "save failed" }, { status: 500 });
  }
}
