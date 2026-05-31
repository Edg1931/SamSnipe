import { NextResponse } from "next/server";
import { scanShelf } from "@/lib/ai";

// POST /api/scan  { base64, mediaType }  → products detected on a shelf photo.
export async function POST(req: Request) {
  try {
    const { base64, mediaType } = (await req.json()) as { base64: string; mediaType: string };
    if (!base64) return NextResponse.json({ error: "No image." }, { status: 400 });
    const result = await scanShelf(base64, mediaType);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scan failed." },
      { status: 500 }
    );
  }
}
