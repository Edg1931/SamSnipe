"use client";

import { useRef, useState } from "react";

interface ScannedProduct { name: string; brand: string; category: string; note: string }

// #10 In-store shelf scanning — snap/upload a shelf photo, Claude identifies the
// products, and you get instant research links. On mobile the file input opens
// the camera directly.
export function ScanModal({ aiOn, onClose }: { aiOn: boolean; onClose: () => void }) {
  const [products, setProducts] = useState<ScannedProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setLoading(true);
    setProducts(null);
    setOffline(false);
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result);
      setPreview(url);
      try {
        const base64 = url.split(",")[1] ?? "";
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mediaType: file.type }),
        });
        const d = await res.json();
        if (d.source === "offline") setOffline(true);
        setProducts(d.products ?? []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  const amazonSearch = (q: string) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-rise relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Shelf scan</h2>
            <p className="text-[11px] text-text-dim">Snap a clearance shelf — AI IDs the products to research.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        {!aiOn && (
          <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-[11px] text-warn">
            AI vision is offline — add ANTHROPIC_API_KEY to .env.local to identify products from a shelf photo.
          </p>
        )}

        <div
          onClick={() => fileRef.current?.click()}
          className="mt-4 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border py-8 text-center hover:border-accent/40"
        >
          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-text-dim"><Spinner /> Scanning shelf…</div>
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="shelf" className="max-h-40 rounded-lg" />
          ) : (
            <>
              <div className="text-3xl">📸</div>
              <p className="mt-2 text-[13px] font-medium text-text">Take or upload a shelf photo</p>
              <p className="text-[11px] text-text-faint">On mobile this opens your camera</p>
            </>
          )}
        </div>

        {offline && (
          <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-[12px] text-warn">
            AI is offline — add ANTHROPIC_API_KEY to .env.local to identify products from photos.
          </p>
        )}

        {products && products.length > 0 && (
          <div className="mt-4 flex-1 space-y-1.5 overflow-y-auto">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">{products.length} products found</div>
            {products.map((p, i) => (
              <a
                key={i} href={amazonSearch(`${p.brand} ${p.name}`)} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-black/20 p-2.5 hover:border-accent/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-text">{p.name}</div>
                  <div className="text-[10px] text-text-dim">{p.brand} · {p.category} — {p.note}</div>
                </div>
                <span className="shrink-0 text-[11px] text-accent">Research ↗</span>
              </a>
            ))}
          </div>
        )}
        {products && products.length === 0 && !offline && !loading && (
          <p className="mt-3 text-center text-[12px] text-text-dim">No products detected — try a clearer photo.</p>
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
