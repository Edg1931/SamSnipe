// Tiny durable key-value layer for the Auto-Pilot backend.
//
// Uses Vercel KV / Upstash Redis over its REST API when KV_REST_API_URL +
// KV_REST_API_TOKEN are set (one-click "Storage" add-on in Vercel). Falls back
// to an in-process Map otherwise — fine for local dev, but not shared across
// serverless invocations, so the scheduled cron needs real KV to be useful.

// Accept both naming conventions: Vercel KV / Marketplace Redis inject KV_*,
// while a direct Upstash integration injects UPSTASH_REDIS_REST_*. Either works.
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const storeConfigured = Boolean(URL && TOKEN);

const mem = new Map<string, string>();

async function cmd(args: string[]): Promise<{ result?: unknown } | null> {
  if (!storeConfigured) return null;
  try {
    const res = await fetch(URL!, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { result?: unknown };
  } catch {
    return null;
  }
}

export async function kvGet(key: string): Promise<string | null> {
  if (!storeConfigured) return mem.get(key) ?? null;
  const r = await cmd(["GET", key]);
  return (r?.result as string | null) ?? null;
}

export async function kvSet(key: string, val: string): Promise<void> {
  if (!storeConfigured) { mem.set(key, val); return; }
  await cmd(["SET", key, val]);
}

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const s = await kvGet(key);
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export async function setJSON(key: string, val: unknown): Promise<void> {
  await kvSet(key, JSON.stringify(val));
}

// Namespaced keys.
export const K = {
  watches: "samsnipe:watches",
  seen: "samsnipe:seen",
  inbox: "samsnipe:inbox",
  findings: "samsnipe:findings",
};
