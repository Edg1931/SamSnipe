import { NextResponse } from "next/server";
import { getJSON, storeConfigured, storeBackend, K } from "@/lib/store";
import type { Findings } from "@/lib/autopilotRun";
import type { Deal } from "@/lib/types";

// GET /api/autopilot/findings — the Auto-Pilot inbox (what it found while away).
export async function GET() {
  const findings = await getJSON<Findings | null>(K.findings, null);
  const inbox = await getJSON<Deal[]>(K.inbox, []);
  return NextResponse.json({ findings, inbox, storeConfigured, storeBackend });
}
