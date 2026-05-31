import { NextResponse } from "next/server";
import { extractInvoice } from "@/lib/ai";

// POST /api/invoice  { base64, mediaType }  → AI-extracted invoice fields.
// Returns blank fields (source: "manual") when AI is unavailable.
export async function POST(req: Request) {
  try {
    const { base64, mediaType } = (await req.json()) as { base64: string; mediaType: string };
    if (!base64) return NextResponse.json({ error: "No file data." }, { status: 400 });
    const result = await extractInvoice(base64, mediaType);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extraction failed." },
      { status: 500 }
    );
  }
}
