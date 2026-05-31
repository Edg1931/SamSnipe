import { NextResponse } from "next/server";
import { keepaStatus, KEEPA_KEY_PRESENT, KEEPA_LIVE } from "@/lib/keepa";
import { aiEnabled, aiModel } from "@/lib/ai";
import { retailLive } from "@/lib/retail";
import { storeBackend, storeConfigured, kvGet, kvSet } from "@/lib/store";

export type Health = "live" | "ready" | "off" | "error";

export interface Integration {
  id: string;
  name: string;
  health: Health;
  required: boolean;
  detail: string;
  envVars: string[];
  docs?: string;
}

// Round-trips a value through the store to prove it actually reads & writes.
async function storePing(): Promise<{ ok: boolean; detail: string }> {
  if (!storeConfigured) return { ok: false, detail: "In-memory only — not shared across requests. Optional for on-demand use." };
  try {
    const nonce = String(Date.now());
    await kvSet("samsnipe:health", nonce);
    const got = await kvGet("samsnipe:health");
    return got === nonce
      ? { ok: true, detail: `Connected — read/write verified (${storeBackend}).` }
      : { ok: false, detail: `Configured (${storeBackend}) but the read-back didn't match — check credentials/permissions.` };
  } catch (e) {
    return { ok: false, detail: `Configured (${storeBackend}) but errored: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

// GET /api/status — aggregate health of every integration for the /setup page.
export async function GET() {
  const integrations: Integration[] = [];

  // --- Keepa (core) ---
  try {
    const k = await keepaStatus();
    let health: Health = "off";
    if (k.willServeLive) health = "live";
    else if (k.keyPresent && k.ok) health = "ready";
    else if (k.keyPresent) health = "error";
    integrations.push({
      id: "keepa",
      name: "Keepa — Amazon price & BSR",
      health,
      required: true,
      detail: String(k.reason ?? ""),
      envVars: ["KEEPA_API_KEY", "SAMSNIPE_DEAL_LIMIT"],
      docs: "https://keepa.com/#!api",
    });
  } catch (e) {
    integrations.push({
      id: "keepa", name: "Keepa — Amazon price & BSR", health: KEEPA_KEY_PRESENT ? "error" : "off",
      required: true, detail: e instanceof Error ? e.message : "probe failed",
      envVars: ["KEEPA_API_KEY"], docs: "https://keepa.com/#!api",
    });
  }

  // --- Anthropic / AI (core) ---
  integrations.push({
    id: "anthropic",
    name: "Anthropic — AI verdicts & web discovery",
    health: aiEnabled() ? "live" : "off",
    required: true,
    detail: aiEnabled()
      ? `Connected · model ${aiModel()}. Powers AI buy/watch/pass verdicts, the brief parser, web Discover, shelf scan & invoice OCR.`
      : "No ANTHROPIC_API_KEY — the app falls back to rule-based verdicts and demo data (no AI web Discover).",
    envVars: ["ANTHROPIC_API_KEY", "SAMSNIPE_AI_MODEL"],
    docs: "https://console.anthropic.com/",
  });

  // --- Durable store (optional) ---
  const ping = await storePing();
  integrations.push({
    id: "store",
    name: "Durable store — Auto-Pilot memory",
    health: storeConfigured ? (ping.ok ? "live" : "error") : "off",
    required: false,
    detail: ping.detail,
    envVars: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "KV_REST_API_URL", "KV_REST_API_TOKEN"],
    docs: "https://supabase.com/dashboard",
  });

  // --- SerpApi retail pricing (optional) ---
  integrations.push({
    id: "serpapi",
    name: "SerpApi — live retailer prices",
    health: retailLive() ? "live" : process.env.SERPAPI_KEY ? "ready" : "off",
    required: false,
    detail: retailLive()
      ? "Live — source-option prices come from real retailer searches."
      : process.env.SERPAPI_KEY
        ? "Key present but RETAIL_LIVE is not 1 — set RETAIL_LIVE=1 to use live prices."
        : "Not set — retailer source prices use the estimate model.",
    envVars: ["SERPAPI_KEY", "RETAIL_LIVE"],
    docs: "https://serpapi.com/manage-api-key",
  });

  // --- Resend email (optional) ---
  const resendKey = Boolean(process.env.RESEND_API_KEY);
  const resendTo = Boolean(process.env.AUTOPILOT_EMAIL);
  integrations.push({
    id: "resend",
    name: "Resend — Auto-Pilot email digests",
    health: resendKey && resendTo ? "live" : resendKey || resendTo ? "ready" : "off",
    required: false,
    detail: resendKey && resendTo
      ? "Configured — Run now emails a digest when new deals are found."
      : resendKey
        ? "RESEND_API_KEY set, but AUTOPILOT_EMAIL is missing — add the recipient."
        : resendTo
          ? "AUTOPILOT_EMAIL set, but RESEND_API_KEY is missing."
          : "Not set — no email alerts (optional).",
    envVars: ["RESEND_API_KEY", "AUTOPILOT_EMAIL"],
    docs: "https://resend.com/api-keys",
  });

  const live = integrations.filter((i) => i.health === "live").length;
  const coreReady = integrations.filter((i) => i.required).every((i) => i.health === "live");

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary: { live, total: integrations.length, coreReady },
    config: {
      keepaLive: KEEPA_LIVE,
      dealLimit: Number(process.env.SAMSNIPE_DEAL_LIMIT || "12"),
      minSafety: Number(process.env.AUTOPILOT_MIN_SAFETY || "60"),
      cronSecret: Boolean(process.env.CRON_SECRET),
      aiModel: aiModel(),
    },
    integrations,
  });
}
