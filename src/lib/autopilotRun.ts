// The Auto-Pilot engine. Builds a fresh deal pool (Keepa live + AI web search),
// runs every enabled watch against it, keeps only new BUY-grade, account-safe
// finds (deduped against what we've already surfaced), and stores them in an
// inbox the app reads. Triggered by the cron or the in-app "Run now" button.

import type { Deal } from "./types";
import type { SavedSearch } from "./autopilot";
import { liveDeals, resolveCandidates, KEEPA_LIVE } from "./keepa";
import { discoverDeals, aiEnabled } from "./ai";
import { generateDeals } from "./mockData";
import { parseQuery, applyQuery } from "./search";
import { computeSurvival } from "./survival";
import { getJSON, setJSON, storeConfigured, K } from "./store";

export interface Findings {
  ranAt: string;
  totalNew: number;
  byWatch: { name: string; count: number }[];
  poolSize: number;
  store: "kv" | "memory";
  keepaLive: boolean;
  aiWeb: boolean;
  demo: boolean;
}

const MIN_SAFETY = Number(process.env.AUTOPILOT_MIN_SAFETY || "60");

export async function runAutopilot(opts?: { web?: boolean }): Promise<{ findings: Findings; inbox: Deal[] }> {
  const watches = (await getJSON<SavedSearch[]>(K.watches, [])).filter((w) => w.enabled);

  // Build the candidate pool, frugally.
  let pool: Deal[] = [];
  try { pool = await liveDeals(); } catch { /* keep going */ }
  const useWeb = opts?.web !== false && aiEnabled();
  if (useWeb) {
    try {
      const { candidates } = await discoverDeals();
      if (candidates.length) pool = [...pool, ...(await resolveCandidates(candidates))];
    } catch { /* additive */ }
  }

  // Demo mode: with no live source configured, hunt the demo feed so "Run now"
  // still demonstrates the workflow (finds are labeled "Demo" by the trust layer).
  const demoMode = !KEEPA_LIVE && !useWeb;
  if (demoMode && pool.length === 0) {
    pool = generateDeals(Math.floor(Math.random() * 1_000_000), 24);
  }

  const seen = new Set(await getJSON<string[]>(K.seen, []));
  const fresh: Deal[] = [];
  const byWatch: { name: string; count: number }[] = [];

  // If there are no watches, surface all BUY-grade safe deals as the catch-all.
  const effectiveWatches: SavedSearch[] = watches.length
    ? watches
    : [{ id: "all", name: "All BUY-grade finds", query: "", enabled: true, createdAt: "" }];

  for (const w of effectiveWatches) {
    const matched = (w.query ? applyQuery(pool, parseQuery(w.query)) : pool)
      .filter((d) => d.verdict === "BUY" && computeSurvival(d).score >= MIN_SAFETY);
    let count = 0;
    for (const d of matched) {
      const key = d.match.asin !== "—" ? d.match.asin : d.id;
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.push({ ...d, foundAt: new Date().toISOString() });
      count++;
    }
    byWatch.push({ name: w.name, count });
  }

  // Roll fresh finds into the inbox. We always return this inline so "Run now"
  // shows results even with no durable store (the read-back GET would hit a
  // different serverless invocation and miss in-memory data).
  const prevInbox = await getJSON<Deal[]>(K.inbox, []);
  const inbox = fresh.length ? [...fresh, ...prevInbox].slice(0, 120) : prevInbox;

  // Persist (best-effort): cap seen history; store inbox when a store exists.
  await setJSON(K.seen, [...seen].slice(-3000));
  if (fresh.length) await setJSON(K.inbox, inbox);

  const findings: Findings = {
    ranAt: new Date().toISOString(),
    totalNew: fresh.length,
    byWatch,
    poolSize: pool.length,
    store: storeConfigured ? "kv" : "memory",
    keepaLive: KEEPA_LIVE,
    aiWeb: useWeb,
    demo: demoMode,
  };
  await setJSON(K.findings, findings);

  // Optional email alert (Resend) when there are new finds.
  if (fresh.length && process.env.RESEND_API_KEY && process.env.AUTOPILOT_EMAIL) {
    try { await emailDigest(fresh, findings); } catch { /* best-effort */ }
  }

  return { findings, inbox };
}

async function emailDigest(deals: Deal[], f: Findings) {
  const rows = deals.slice(0, 15).map((d) =>
    `<tr><td>${d.title}</td><td>${d.roi}% ROI</td><td>$${d.sourcePrice}→$${d.amazonPrice}</td><td><a href="${d.sourceUrl}">${d.source}</a></td></tr>`
  ).join("");
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "SamSnipe <onboarding@resend.dev>",
      to: process.env.AUTOPILOT_EMAIL,
      subject: `SamSnipe Auto-Pilot: ${f.totalNew} new deal${f.totalNew === 1 ? "" : "s"}`,
      html: `<h2>${f.totalNew} new BUY-grade finds</h2><table border="1" cellpadding="6">${rows}</table>`,
    }),
  });
}
