// Durable key-value layer for the Auto-Pilot backend, with three interchangeable
// backends (auto-detected, in priority order):
//   1. Supabase  — SUPABASE_URL + a service-role/anon key (a single kv table).
//   2. Redis/KV  — KV_REST_API_* or UPSTASH_REDIS_REST_* (REST API).
//   3. memory    — in-process fallback (dev only; not shared across invocations).
//
// All three speak the same get/set-string interface, so the rest of the app is
// backend-agnostic. Server-only (used from API routes / the cron).

// --- Redis / Vercel KV ---
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// --- Supabase ---
const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SB_TABLE = process.env.SUPABASE_KV_TABLE || "samsnipe_kv";

export type StoreBackend = "supabase" | "redis" | "memory";
export const storeBackend: StoreBackend = SB_URL && SB_KEY ? "supabase" : KV_URL && KV_TOKEN ? "redis" : "memory";
export const storeConfigured = storeBackend !== "memory";

const mem = new Map<string, string>();

// --- Redis REST command ---
async function redisCmd(args: string[]): Promise<{ result?: unknown } | null> {
  try {
    const res = await fetch(KV_URL!, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { result?: unknown };
  } catch {
    return null;
  }
}

// --- Supabase (PostgREST) ---
const sbHeaders = () => ({
  apikey: SB_KEY!,
  Authorization: `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
});

async function sbGet(key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/${SB_TABLE}?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: sbHeaders(), cache: "no-store" }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { value: string }[];
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function sbSet(key: string, value: string): Promise<void> {
  try {
    await fetch(`${SB_URL}/rest/v1/${SB_TABLE}`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ key, value }]),
      cache: "no-store",
    });
  } catch {
    /* best-effort */
  }
}

// --- Unified interface ---
export async function kvGet(key: string): Promise<string | null> {
  if (storeBackend === "supabase") return sbGet(key);
  if (storeBackend === "redis") {
    const r = await redisCmd(["GET", key]);
    return (r?.result as string | null) ?? null;
  }
  return mem.get(key) ?? null;
}

export async function kvSet(key: string, val: string): Promise<void> {
  if (storeBackend === "supabase") return sbSet(key, val);
  if (storeBackend === "redis") { await redisCmd(["SET", key, val]); return; }
  mem.set(key, val);
}

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const s = await kvGet(key);
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export async function setJSON(key: string, val: unknown): Promise<void> {
  await kvSet(key, JSON.stringify(val));
}

export const K = {
  watches: "samsnipe:watches",
  seen: "samsnipe:seen",
  inbox: "samsnipe:inbox",
  findings: "samsnipe:findings",
};
