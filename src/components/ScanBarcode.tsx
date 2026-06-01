"use client";

import { useEffect, useRef, useState } from "react";
import type { Deal } from "@/lib/types";
import { useEscape } from "@/lib/hooks";
import { toast } from "@/lib/toast";

// In-store barcode scanner: point the phone camera at a shelf tag (native
// BarcodeDetector), or type the UPC. Resolves to a real Amazon deal (SP-API)
// and opens it for an instant buy/pass verdict. Camera degrades to manual entry.
export function ScanBarcode({ onClose, onResult }: { onClose: () => void; onResult: (d: Deal) => void }) {
  useEscape(onClose);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camActive, setCamActive] = useState(false);
  const [code, setCode] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function lookup(value: string) {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: v, cost: cost ? Number(cost) : undefined }),
      });
      const d = await r.json();
      if (d.found && d.deal) { toast.success(`Found: ${d.deal.title}`); onResult(d.deal as Deal); }
      else setErr(d.message || "No Amazon match for that barcode.");
    } catch {
      setErr("Lookup failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  // Live camera scan via the native BarcodeDetector (Chrome/Android, Safari 17+).
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let alive = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (typeof window !== "undefined" ? (window as any).BarcodeDetector : undefined);
    if (!BD) return; // no support → manual entry only
    (async () => {
      try {
        const detector = new BD({ formats: ["upc_a", "upc_e", "ean_13", "ean_8"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setCamActive(true); }
        timer = setInterval(async () => {
          if (!alive || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const val = codes?.[0]?.rawValue;
            if (val) { setCode(val); toast.info(`Scanned ${val}`); if (timer) clearInterval(timer); lookup(val); }
          } catch { /* frame miss */ }
        }, 500);
      } catch {
        setErr("Camera unavailable — enter the barcode below.");
      }
    })();
    return () => { alive = false; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-rise relative w-full max-w-md rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Scan a barcode</h2>
            <p className="text-[11px] text-text-dim">Point at a shelf tag or type the UPC — instant Amazon verdict.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        {/* Camera viewfinder */}
        <div className="mt-3 aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-black/40">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          {!camActive && (
            <div className="grid h-full place-items-center text-center text-[11px] text-text-faint">
              <span>Camera scanning isn&apos;t available here —<br />enter the barcode manually below.</span>
            </div>
          )}
        </div>
        {camActive && <p className="mt-1.5 text-center text-[11px] text-accent">Scanning… hold the barcode steady in frame</p>}

        {/* Manual entry + optional cost */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <input
            value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup(code)}
            inputMode="numeric" placeholder="UPC / barcode digits"
            className="col-span-2 rounded-lg border border-border bg-black/30 px-3 py-2 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-primary/50"
          />
          <div className="flex items-center rounded-lg border border-border bg-black/30 px-2">
            <span className="text-text-faint">$</span>
            <input
              value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="cost"
              className="w-full bg-transparent py-2 pl-1 text-[13px] text-text placeholder:text-text-faint outline-none"
            />
          </div>
        </div>
        <button
          onClick={() => lookup(code)} disabled={busy || !code.trim()}
          className="mt-2 w-full rounded-lg bg-primary py-2.5 text-[13px] font-semibold text-white transition hover:bg-primary-dim disabled:opacity-50"
        >
          {busy ? "Looking up…" : "Look up on Amazon"}
        </button>
        {err && <p className="mt-2 text-[11px] text-warn">{err}</p>}
        <p className="mt-2 text-[10px] leading-snug text-text-faint">
          Optional: enter the in-store price to see ROI instantly — or open the deal and type it in the profit calculator.
        </p>
      </div>
    </div>
  );
}
