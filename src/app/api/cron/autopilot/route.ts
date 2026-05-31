import { NextResponse } from "next/server";
import { runAutopilot } from "@/lib/autopilotRun";

// GET /api/cron/autopilot — scheduled by Vercel Cron (see vercel.json).
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set;
// we verify it so the endpoint can't be triggered by randoms.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const url = new URL(req.url);
    if (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const findings = await runAutopilot();
  return NextResponse.json(findings);
}
