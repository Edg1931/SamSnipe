import { NextResponse } from "next/server";
import { runAutopilot } from "@/lib/autopilotRun";

// POST /api/autopilot/run — manual "Run now" trigger from the app.
// Returns { findings, inbox } so the UI can show results without a durable store.
export async function POST() {
  try {
    const { findings, inbox } = await runAutopilot();
    return NextResponse.json({ findings, inbox });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Auto-Pilot run failed." },
      { status: 500 }
    );
  }
}
