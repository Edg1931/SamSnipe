import { NextResponse } from "next/server";
import { runAutopilot } from "@/lib/autopilotRun";

// GET /api/cron/autopilot — endpoint for an optional scheduled run.
// Auto-Pilot is on-demand by default ("crons": [] in vercel.json). To enable a
// daily run, add a cron entry pointing here and set CRON_SECRET. When set, Vercel
// sends `Authorization: Bearer <CRON_SECRET>`; we verify it so randoms can't trigger it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const url = new URL(req.url);
    if (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const { findings } = await runAutopilot();
  return NextResponse.json(findings);
}
