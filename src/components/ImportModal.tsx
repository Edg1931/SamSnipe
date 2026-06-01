"use client";

import { useRef, useState } from "react";
import type { Deal } from "@/lib/types";
import type { Field } from "@/lib/import";
import { useEscape } from "@/lib/hooks";

interface ManifestAnalysis {
  units: number; lines: number; profitableLines: number;
  cost: number; revenue: number; profit: number; roi: number;
  maxBid: number; verdict: "BUY" | "WATCH" | "PASS"; note: string;
}
interface ImportResponse {
  deals: Deal[];
  columnMap: { mapping: Record<Field, string | null>; unmatched: string[] };
  rowsRead: number;
  skipped: number;
  fileName: string;
  manifest?: ManifestAnalysis;
  error?: string;
}

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const VERDICT_TONE: Record<string, string> = { BUY: "#10d98e", WATCH: "#f5a524", PASS: "#f4476b" };

const FIELD_LABELS: Record<Field, string> = {
  asin: "ASIN", upc: "UPC / EAN", title: "Title", brand: "Brand",
  category: "Category", cost: "Your cost", sell: "Sell price", bsr: "BSR",
  url: "Source URL", qty: "Quantity",
};

function PalletStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-black/30 p-1.5">
      <div className="text-[9px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className="text-[12px] font-bold" style={{ color: tone ?? "#e8edf4" }}>{value}</div>
    </div>
  );
}

// Upload an Excel/CSV, auto-map columns, preview, then push rows into the feed.
export function ImportModal({ onImport, onClose }: { onImport: (deals: Deal[]) => void; onClose: () => void }) {
  useEscape(onClose);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data: ImportResponse = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Import failed.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  const fields = Object.keys(FIELD_LABELS) as Field[];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-rise relative w-full max-w-lg rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Import a spreadsheet</h2>
            <p className="text-[11px] text-text-dim">Excel or CSV — we auto-detect your columns.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`mt-4 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed py-12 text-center transition ${
              drag ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {loading ? (
              <div className="flex items-center gap-2 text-[13px] text-text-dim">
                <Spinner /> Parsing & analyzing…
              </div>
            ) : (
              <>
                <div className="text-3xl">📄</div>
                <p className="mt-2 text-[13px] font-medium text-text">Drop your .xlsx / .csv here</p>
                <p className="text-[11px] text-text-faint">or click to browse</p>
              </>
            )}
          </div>
        )}

        {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-[#f88aa1]">{error}</p>}

        {result && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text">📄 {result.fileName}</span>
              <span className="text-text-dim">
                {result.deals.length} ready · {result.skipped} skipped of {result.rowsRead} rows
              </span>
            </div>

            {result.manifest && (
              <div
                className="mt-3 rounded-xl border p-3"
                style={{ borderColor: `${VERDICT_TONE[result.manifest.verdict]}40`, background: `${VERDICT_TONE[result.manifest.verdict]}0d` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: VERDICT_TONE[result.manifest.verdict] }}>
                    📦 Pallet analysis · {result.manifest.verdict}
                  </span>
                  <span className="text-[11px] text-text-dim">{result.manifest.units} units · {result.manifest.profitableLines}/{result.manifest.lines} lines profitable</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  <PalletStat label="Cost" value={usd(result.manifest.cost)} />
                  <PalletStat label="Resale" value={usd(result.manifest.revenue)} />
                  <PalletStat label="Profit" value={usd(result.manifest.profit)} tone="#10d98e" />
                  <PalletStat label="ROI" value={`${result.manifest.roi}%`} tone={VERDICT_TONE[result.manifest.verdict]} />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-text">{result.manifest.note}</p>
                <p className="mt-1 text-[11px] font-semibold text-accent">Suggested max bid: {usd(result.manifest.maxBid)}</p>
              </div>
            )}

            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-text-dim">Detected columns</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {fields.map((f) => {
                const matched = result.columnMap.mapping[f];
                return (
                  <div key={f} className="flex items-center justify-between rounded-lg border border-border bg-black/20 px-2.5 py-1.5 text-[11px]">
                    <span className="text-text-dim">{FIELD_LABELS[f]}</span>
                    {matched ? (
                      <span className="font-medium text-accent">“{matched}”</span>
                    ) : (
                      <span className="text-text-faint">not found</span>
                    )}
                  </div>
                );
              })}
            </div>

            {result.columnMap.unmatched.length > 0 && (
              <p className="mt-2 text-[10px] text-text-faint">
                Ignored columns: {result.columnMap.unmatched.join(", ")}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button onClick={() => setResult(null)} className="flex-1 rounded-xl border border-border bg-white/5 py-2.5 text-[12px] font-medium text-text hover:bg-white/10">
                Choose a different file
              </button>
              <button
                onClick={() => { onImport(result.deals); onClose(); }}
                disabled={result.deals.length === 0}
                className="flex-1 rounded-xl bg-accent py-2.5 text-[12px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                Add {result.deals.length} to feed
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
