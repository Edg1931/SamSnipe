"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Health = "live" | "ready" | "off" | "error";
interface Integration {
  id: string; name: string; health: Health; required: boolean;
  detail: string; envVars: string[]; docs?: string;
}
interface Status {
  generatedAt: string;
  summary: { live: number; total: number; coreReady: boolean };
  config: { keepaLive: boolean; dealLimit: number; minSafety: number; cronSecret: boolean; aiModel: string };
  integrations: Integration[];
}

const PILL: Record<Health, { label: string; color: string }> = {
  live: { label: "Live", color: "#10d98e" },
  ready: { label: "Ready", color: "#38bdf8" },
  error: { label: "Needs attention", color: "#f4476b" },
  off: { label: "Not set", color: "#64748b" },
};

export default function SetupPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      setStatus(await r.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — fetch inside the effect so state only updates after await.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        if (!r.ok) throw new Error(`status ${r.status}`);
        const d = await r.json();
        if (alive) setStatus(d);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Failed to load status");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const core = status?.integrations.filter((i) => i.required) ?? [];
  const optional = status?.integrations.filter((i) => !i.required) ?? [];

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-3xl px-5 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-[12px] text-text-dim hover:text-accent">← Back to deals</Link>
            <h1 className="mt-1 text-2xl font-bold">Setup &amp; Status</h1>
            <p className="text-[13px] text-text-dim">What&apos;s live, what&apos;s optional, and exactly what to set to turn each on.</p>
          </div>
          <button
            onClick={refresh} disabled={loading}
            className="rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-black hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Checking…" : "Re-check"}
          </button>
        </div>

        {/* Summary */}
        {status && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Summary label="Integrations live" value={`${status.summary.live} / ${status.summary.total}`} tone="#10d98e" />
            <Summary
              label="Core ready to source"
              value={status.summary.coreReady ? "Yes" : "Not yet"}
              tone={status.summary.coreReady ? "#10d98e" : "#f5a524"}
            />
            <Summary label="AI model" value={status.config.aiModel} tone="#6366f1" small />
          </div>
        )}

        {err && (
          <div className="mt-5 rounded-xl border border-danger/40 bg-danger/10 p-4 text-[13px] text-[#f88aa1]">
            Couldn&apos;t load status: {err}
          </div>
        )}

        {/* Core */}
        {core.length > 0 && (
          <Section title="Core — powers the deal engine" subtitle="Set these to pull real Amazon data and AI verdicts.">
            {core.map((i) => <Card key={i.id} it={i} />)}
          </Section>
        )}

        {/* Optional */}
        {optional.length > 0 && (
          <Section title="Optional — automation & extras" subtitle="Nice to have; the app works without them.">
            {optional.map((i) => <Card key={i.id} it={i} />)}
          </Section>
        )}

        {/* Config snapshot */}
        {status && (
          <div className="mt-6 rounded-2xl border border-border bg-black/20 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">Configuration</div>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-3">
              <Cfg k="Keepa live" v={status.config.keepaLive ? "on" : "off"} />
              <Cfg k="Deals / fetch" v={String(status.config.dealLimit)} />
              <Cfg k="Min safety score" v={String(status.config.minSafety)} />
              <Cfg k="Cron secret" v={status.config.cronSecret ? "set" : "not set"} />
              <Cfg k="AI model" v={status.config.aiModel} />
            </div>
          </div>
        )}

        {/* How-to */}
        <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-[12px] leading-relaxed text-text-dim">
          <span className="font-semibold text-text">Adding a key:</span> set the env var in
          {" "}<span className="text-text">Vercel → Project → Settings → Environment Variables</span> (scope Production),
          then <span className="text-text">redeploy</span> — env vars only apply to new deployments. Re-check this page afterward.
        </div>

        {status && (
          <p className="mt-4 text-center text-[10px] text-text-faint">
            Checked {new Date(status.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="text-[12px] text-text-dim">{subtitle}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function Card({ it }: { it: Integration }) {
  const pill = PILL[it.health];
  return (
    <div className="glass animate-rise rounded-2xl border border-border p-4" style={{ borderColor: `${pill.color}33` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: pill.color }} />
            <span className="text-[14px] font-semibold">{it.name}</span>
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-text-dim">{it.detail}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {it.envVars.map((e) => (
              <code key={e} className="rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] text-text-faint">{e}</code>
            ))}
            {it.docs && (
              <a href={it.docs} target="_blank" rel="noopener noreferrer" className="text-[11px] text-accent hover:underline">get key ↗</a>
            )}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ color: pill.color, background: `${pill.color}1f` }}
        >
          {pill.label}
        </span>
      </div>
    </div>
  );
}

function Summary({ label, value, tone, small }: { label: string; value: string; tone: string; small?: boolean }) {
  return (
    <div className="glass rounded-2xl border border-border p-4">
      <div className="text-[11px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className={`mt-1 font-bold ${small ? "truncate text-sm" : "text-2xl"}`} style={{ color: tone }}>{value}</div>
    </div>
  );
}

function Cfg({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border-soft py-0.5">
      <span className="text-text-faint">{k}</span>
      <span className="font-medium text-text">{v}</span>
    </div>
  );
}
