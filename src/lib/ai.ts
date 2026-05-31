// Server-side AI layer for SamSnipe, powered by the Anthropic SDK.
//
// Three jobs:
//   1. analyzeDeal  — structured Buy/Watch/Pass verdict + reasoning + risks
//   2. parseBrief   — natural-language sourcing brief → structured filters
//   3. copilot      — conversational sourcing assistant that learns from the
//                     user's Buy/Pass history
//
// Everything degrades gracefully: with no ANTHROPIC_API_KEY the rule-based
// fallbacks run, so the app keeps working. Add the key to .env.local and the
// same calls light up with real Claude. Latest model: claude-opus-4-8.

import Anthropic from "@anthropic-ai/sdk";
import type { Deal, Verdict } from "./types";
import { decideVerdict } from "./verdict";
import { estimateVelocity } from "./velocity";
import { parseQuery, type ParsedQuery } from "./search";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.SAMSNIPE_AI_MODEL || "claude-opus-4-8";

export const aiEnabled = (): boolean => Boolean(KEY);

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: KEY });
  return _client;
}

// Stable analyst persona — cached as a prompt prefix so repeat calls are cheap.
const ANALYST_SYSTEM = `You are SamSnipe's sourcing analyst for Amazon US (FBA) resellers.
You judge whether a product sourced off-Amazon is worth reselling on Amazon.
Priorities, in order:
1. ASIN-match trust — a wrong ASIN makes every other number meaningless. If match confidence is low, never say BUY.
2. Account safety — flag IP-complaint risk, gated brands/categories, hazmat, and pack-size/variation mismatches.
3. Real sell-through — a good spread on a slow mover (very high BSR, few monthly sales) is a trap.
4. Profitability — ROI and margin after Amazon referral + FBA fees.
Be concise, specific, and honest. Reference the actual numbers you were given.`;

function dealFacts(deal: Deal): string {
  const v = estimateVelocity(deal);
  return [
    `Title: ${deal.title}`,
    `Brand: ${deal.brand} | Category: ${deal.category}`,
    `ASIN: ${deal.match.asin} | match confidence: ${deal.match.confidence}% via ${deal.match.method.join("+")}${deal.match.packSizeWarning ? " (PACK-SIZE WARNING)" : ""}`,
    `Source: ${deal.source} @ $${deal.sourcePrice} | Amazon buy-box: $${deal.amazonPrice}`,
    `Computed ROI: ${deal.roi}% | margin: ${deal.margin}% | net profit/unit: $${deal.profit} | fees: $${deal.fbaFees}`,
    `BSR: #${deal.bsr.toLocaleString()} in ${deal.bsrCategory} | offers: ${deal.offerCount}`,
    `Est. sell-through: ${v.unitsLow}-${v.unitsHigh}/mo (confidence ${v.confidence}%), competition decay: ${v.decay}`,
    `Pre-flagged risks: ${deal.risks.join(", ") || "none"}`,
  ].join("\n");
}

export interface AIVerdict {
  verdict: Verdict;
  confidence: number;
  reason: string;
  risks: string[];
  keyFactors: string[];
  source: "ai" | "rules";
}

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["BUY", "WATCH", "PASS"] },
    confidence: { type: "integer" },
    reason: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    keyFactors: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "confidence", "reason", "risks", "keyFactors"],
} as const;

export async function analyzeDeal(deal: Deal): Promise<AIVerdict> {
  if (!aiEnabled()) {
    const v = estimateVelocity(deal);
    const { verdict, reason } = decideVerdict(deal.roi, deal.match.confidence, deal.risks);
    return {
      verdict,
      confidence: Math.round((deal.match.confidence + v.confidence) / 2),
      reason,
      risks: deal.risks.map(String),
      keyFactors: [`${deal.roi}% ROI`, `BSR #${deal.bsr.toLocaleString()}`, v.note],
      source: "rules",
    };
  }
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: ANALYST_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } },
    messages: [{ role: "user", content: `Analyze this deal and return your verdict.\n\n${dealFacts(deal)}` }],
  });
  const text = res.content.find((b) => b.type === "text");
  const parsed = JSON.parse((text as { text: string }).text);
  return { ...parsed, source: "ai" };
}

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    maxCost: { type: ["number", "null"] },
    minRoi: { type: ["number", "null"] },
    maxBsr: { type: ["number", "null"] },
    category: { type: ["string", "null"] },
    brand: { type: ["string", "null"] },
    verdict: { type: ["string", "null"], enum: ["BUY", "WATCH", "PASS", null] },
    understood: { type: "array", items: { type: "string" } },
  },
  required: ["understood"],
} as const;

export async function parseBrief(text: string): Promise<ParsedQuery> {
  if (!aiEnabled() || !text.trim()) return parseQuery(text);
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 512,
      thinking: { type: "disabled" },
      system: [{
        type: "text",
        text: "Convert a reseller's natural-language sourcing brief into structured filter criteria for Amazon US. Categories must be one of: Toys, Electronics, Home & Kitchen, Sports & Outdoors, Beauty, Tools & Home Improvement. 'understood' is a short human-readable echo of each criterion you extracted (e.g. 'ROI ≥ 50%').",
        cache_control: { type: "ephemeral" },
      }],
      output_config: { format: { type: "json_schema", schema: BRIEF_SCHEMA } },
      messages: [{ role: "user", content: text }],
    });
    const block = res.content.find((b) => b.type === "text");
    const p = JSON.parse((block as { text: string }).text);
    // Drop nulls so the filter logic treats them as "unset".
    const clean: ParsedQuery = { understood: p.understood ?? [] };
    if (p.maxCost != null) clean.maxCost = p.maxCost;
    if (p.minRoi != null) clean.minRoi = p.minRoi;
    if (p.maxBsr != null) clean.maxBsr = p.maxBsr;
    if (p.category) clean.category = p.category;
    if (p.brand) clean.brand = p.brand;
    if (p.verdict) clean.verdict = p.verdict;
    return clean;
  } catch {
    return parseQuery(text);
  }
}

export interface CopilotTurn {
  role: "user" | "assistant";
  content: string;
}

export async function copilot(opts: {
  turns: CopilotTurn[];
  deals: Deal[];
  decisions: { bought: string[]; passed: string[] };
}): Promise<{ reply: string; source: "ai" | "rules" }> {
  const { turns, deals, decisions } = opts;
  if (!aiEnabled()) {
    return {
      reply:
        "AI copilot is offline — add ANTHROPIC_API_KEY to .env.local to enable it. " +
        "Meanwhile I can still filter your feed: try the search bar with something like " +
        "'toys under $20 with 50% ROI'.",
      source: "rules",
    };
  }
  // Compact feed snapshot so the model can reason over the current deals.
  const feed = deals
    .slice(0, 25)
    .map((d) => `- ${d.title} | ${d.brand} | ${d.category} | ROI ${d.roi}% | BSR #${d.bsr.toLocaleString()} | conf ${d.match.confidence}% | ${d.verdict}`)
    .join("\n");
  const learned =
    decisions.bought.length || decisions.passed.length
      ? `The user has BOUGHT: ${decisions.bought.slice(0, 20).join(", ") || "none"}. ` +
        `The user has PASSED on: ${decisions.passed.slice(0, 20).join(", ") || "none"}. ` +
        `Infer their taste (categories, price bands, ROI threshold, risk tolerance) and rank suggestions accordingly.`
      : "No buy/pass history yet — ask one short clarifying question if their taste matters.";

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: ANALYST_SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: "You are now in conversational copilot mode. Help the user pick the best deals from THEIR current feed, explain trade-offs, and surface the few that fit their taste. Keep replies tight and skimmable; cite specific deals by name." },
    ],
    messages: [
      ...turns.slice(0, -1).map((t) => ({ role: t.role, content: t.content })),
      {
        role: "user" as const,
        content: `${turns[turns.length - 1]?.content ?? ""}\n\n---\nCurrent feed:\n${feed}\n\nLearned preferences:\n${learned}`,
      },
    ],
  });
  const block = res.content.find((b) => b.type === "text");
  return { reply: (block as { text: string })?.text ?? "(no reply)", source: "ai" };
}
