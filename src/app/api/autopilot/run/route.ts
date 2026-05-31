import { NextResponse } from "next/server";
import { runAutopilot } from "@/lib/autopilotRun";

// POST /api/autopilot/run — manual "Run now" trigger from the app.
export async function POST() {
  try {
    const findings = await runAutopilot();
    return NextResponse.json(findings);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Auto-Pilot run failed." },
      { status: 500 }
    );
  }
}
