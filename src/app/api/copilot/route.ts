import { NextResponse } from "next/server";
import { copilot, type CopilotTurn } from "@/lib/ai";
import type { Deal } from "@/lib/types";

// POST /api/copilot  { turns, deals, decisions }  → conversational reply.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      turns: CopilotTurn[];
      deals: Deal[];
      decisions: { bought: string[]; passed: string[] };
    };
    const result = await copilot({
      turns: body.turns ?? [],
      deals: body.deals ?? [],
      decisions: body.decisions ?? { bought: [], passed: [] },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Copilot failed." },
      { status: 500 }
    );
  }
}
