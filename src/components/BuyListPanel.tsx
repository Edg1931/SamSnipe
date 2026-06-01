"use client";

import { useRef, useState } from "react";
import type { BuyItem, BuyStatus, Defensibility, Invoice, Fulfillment } from "@/lib/buylist";
import { computeTotals, complianceSummary, defensibilityOf, setInvoice, setFulfillment, setTracking } from "@/lib/buylist";
import { usd } from "@/lib/format";
import { sourceLink, amazonUrl, amazonSearch } from "@/lib/links";
import { assessTrust } from "@/lib/trust";
import { useEscape } from "@/lib/hooks";

const STATUSES: BuyStatus[] = ["to_buy", "ordered", "received"];
const STATUS_LABEL: Record<BuyStatus, string> = {
  to_buy: "To buy", ordered: "Ordered", received: "Received",
};
const DEF_META: Record<Defensibility, { label: string; color: string }> = {
  ready: { label: "Defensible", color: "#10d98e" },
  partial: { label: "Needs info", color: "#f5a524" },
  none: { label: "No invoice", color: "#f4476b" },
};

// Buy list + ROI tracker + compliance/invoice vault.
export function BuyListPanel({
  items, onChange, onClose,
}: {
  items: BuyItem[];
  onChange: (items: BuyItem[]) => void;
  onClose: () => void;
}) {
  useEscape(onClose);
  const t = computeTotals(items);
  const c = complianceSummary(items);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);

  const setQty = (id: string, qty: number) =>
    onChange(items.map((i) => (i.deal.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
  const setStatus = (id: string, status: BuyStatus) =>
    onChange(items.map((i) => (i.deal.id === id ? { ...i, status } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.deal.id !== id));
  const saveInvoice = (id: string, inv: Invoice | undefined) => onChange(setInvoice(items, id, inv));
  const chooseFulfillment = (id: string, f: Fulfillment) => onChange(setFulfillment(items, id, f));

  function exportPacket() {
    // A reinstatement packet: everything Amazon asks for during an appeal.
    const packet = {
      generatedAt: new Date().toISOString(),
      marketplace: "Amazon US (amazon.com)",
      items: items.map((i) => ({
        asin: i.deal.match.asin,
        title: i.deal.title,
        brand: i.deal.brand,
        units: i.qty,
        status: i.status,
        defensibility: defensibilityOf(i).level,
        invoice: i.invoice
          ? {
              supplier: i.invoice.supplier,
              purchaseDate: i.invoice.purchaseDate,
              units: i.invoice.units,
              amount: i.invoice.amount,
              document: i.invoice.fileName || null,
            }
          : null,
      })),
    };
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `samsnipe-reinstatement-packet-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass animate-rise relative h-full w-full max-w-lg overflow-y-auto border-l border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Buy list · ROI · compliance</h2>
            <p className="text-[11px] text-text-dim">Committed deals, profit tracking, and your invoice vault.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-text">✕</button>
        </div>

        {/* Totals */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <Total label="Units" value={String(t.units)} />
          <Total label="Capital" value={usd(t.capital)} />
          <Total label="Proj. profit" value={usd(t.projectedProfit)} tone="#10d98e" />
          <Total label="Avg ROI" value={`${t.avgRoi.toFixed(0)}%`} tone="#f5a524" />
        </div>

        {/* Compliance bar */}
        {items.length > 0 && (
          <div className="mt-3 rounded-xl border border-border bg-black/20 p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold uppercase tracking-wide text-text-dim">Invoice defensibility</span>
              <span className="text-text">{c.defensiblePct.toFixed(0)}% of capital protected</span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-black/40">
              <div style={{ width: `${(c.ready / items.length) * 100}%`, background: "#10d98e" }} />
              <div style={{ width: `${(c.partial / items.length) * 100}%`, background: "#f5a524" }} />
              <div style={{ width: `${(c.none / items.length) * 100}%`, background: "#f4476b" }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-text-dim">
              <span>{c.ready} defensible · {c.partial} partial · {c.none} unprotected</span>
              <button onClick={exportPacket} className="rounded-md border border-border bg-white/5 px-2 py-1 font-medium text-text hover:bg-white/10">
                ⬇ Reinstatement packet
              </button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border py-12 text-center text-[12px] text-text-dim">
            Your buy list is empty. Open a deal and hit <span className="text-accent">Add to buy list</span>.
          </p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {items.map((i) => {
              // Verify-or-search: only deep-link a verified ASIN / live source.
              const az = assessTrust(i.deal).level === "verified"
                ? (amazonUrl(i.deal.match.asin) ?? amazonSearch(`${i.deal.brand} ${i.deal.title}`))
                : amazonSearch(`${i.deal.brand} ${i.deal.title}`);
              const src = sourceLink(i.deal);
              const def = defensibilityOf(i);
              const dm = DEF_META[def.level];
              return (
                <div key={i.deal.id} className="rounded-xl border border-border bg-black/20 p-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white/90"
                      style={{ background: `linear-gradient(135deg, ${i.deal.imageColor}, ${i.deal.imageColor}99)` }}
                    >
                      {i.deal.brand.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-text">{i.deal.title}</div>
                      <div className="text-[10px] text-text-dim">
                        <span className="font-mono text-accent">{i.deal.match.asin}</span> · {i.deal.source} · {i.deal.roi}% ROI
                      </div>
                    </div>
                    <button onClick={() => remove(i.deal.id)} className="text-text-faint hover:text-danger" title="Remove">✕</button>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-lg border border-border bg-black/30">
                      <button onClick={() => setQty(i.deal.id, i.qty - 1)} className="px-2 py-1 text-text-dim hover:text-text">−</button>
                      <span className="min-w-7 text-center text-[12px] text-text">{i.qty}</span>
                      <button onClick={() => setQty(i.deal.id, i.qty + 1)} className="px-2 py-1 text-text-dim hover:text-text">+</button>
                    </div>
                    <div className="flex gap-0.5 rounded-lg border border-border bg-black/30 p-0.5">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(i.deal.id, s)}
                          className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                            i.status === s ? "bg-accent/15 text-accent" : "text-text-faint hover:text-text"
                          }`}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto text-right text-[11px]">
                      <span className="text-text-dim">profit </span>
                      <span className="font-semibold text-accent">{usd(i.deal.profit * i.qty)}</span>
                    </div>
                  </div>

                  {/* Fulfillment + dropship tracking */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-text-faint">Fulfill</span>
                    <div className="flex gap-0.5 rounded-lg border border-border bg-black/30 p-0.5">
                      {(["FBA", "FBM", "Dropship"] as Fulfillment[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => chooseFulfillment(i.deal.id, f)}
                          className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                            (i.fulfillment ?? "FBA") === f ? "bg-accent/15 text-accent" : "text-text-faint hover:text-text"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(i.fulfillment === "Dropship" || i.fulfillment === "FBM") && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <TrackInput label="Supplier order #" value={i.tracking?.supplierOrderId ?? ""} onChange={(v) => onChange(setTracking(items, i.deal.id, { ...i.tracking, supplierOrderId: v }))} />
                      <TrackInput label="Carrier" value={i.tracking?.carrier ?? ""} onChange={(v) => onChange(setTracking(items, i.deal.id, { ...i.tracking, carrier: v }))} />
                      <TrackInput label="Tracking #" value={i.tracking?.trackingNumber ?? ""} onChange={(v) => onChange(setTracking(items, i.deal.id, { ...i.tracking, trackingNumber: v }))} />
                      <TrackInput label="ETA" value={i.tracking?.eta ?? ""} onChange={(v) => onChange(setTracking(items, i.deal.id, { ...i.tracking, eta: v }))} placeholder="YYYY-MM-DD" />
                    </div>
                  )}

                  {/* Compliance row */}
                  <div className="mt-2.5 flex items-center justify-between border-t border-border-soft pt-2.5">
                    <button
                      onClick={() => setOpenInvoice(openInvoice === i.deal.id ? null : i.deal.id)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-text-dim hover:text-text"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dm.color }} />
                      {dm.label}
                      <span className="text-text-faint">· {openInvoice === i.deal.id ? "hide" : "invoice"}</span>
                    </button>
                    <div className="flex gap-3 text-[10px]">
                      <a href={src} target="_blank" rel="noopener noreferrer" className="text-text-dim hover:text-text">{i.deal.source} ↗</a>
                      {az && <a href={az} target="_blank" rel="noopener noreferrer" className="text-text-dim hover:text-text">Amazon ↗</a>}
                    </div>
                  </div>

                  {openInvoice === i.deal.id && (
                    <InvoiceEditor
                      item={i}
                      onSave={(inv) => { saveInvoice(i.deal.id, inv); setOpenInvoice(null); }}
                      onClear={() => { saveInvoice(i.deal.id, undefined); }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}

// Inline invoice attach + AI auto-extract + manual fields.
function InvoiceEditor({
  item, onSave, onClear,
}: {
  item: BuyItem;
  onSave: (inv: Invoice) => void;
  onClear: () => void;
}) {
  const inv = item.invoice;
  const [supplier, setSupplier] = useState(inv?.supplier ?? "");
  const [purchaseDate, setPurchaseDate] = useState(inv?.purchaseDate ?? "");
  const [units, setUnits] = useState(inv?.units ?? item.qty);
  const [amount, setAmount] = useState(inv?.amount ?? item.deal.sourcePrice * item.qty);
  const [fileName, setFileName] = useState(inv?.fileName ?? "");
  const [dataUrl, setDataUrl] = useState(inv?.dataUrl);
  const [extracting, setExtracting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setFileName(file.name);
    setNote(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const url = String(reader.result);
      // Keep localStorage healthy — only persist the document if it's small.
      if (file.size <= 1_500_000) setDataUrl(url);
      else setNote("File stored as reference only (too large to embed).");

      // AI auto-extract (falls back to manual when offline).
      setExtracting(true);
      try {
        const base64 = url.split(",")[1] ?? "";
        const res = await fetch("/api/invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mediaType: file.type }),
        });
        const d = await res.json();
        if (d.source === "ai") {
          if (d.supplier) setSupplier(d.supplier);
          if (d.purchaseDate) setPurchaseDate(d.purchaseDate);
          if (d.units) setUnits(d.units);
          if (d.amount) setAmount(d.amount);
          setNote("Fields auto-filled by Claude — review before saving.");
        } else {
          setNote("AI offline — enter the fields manually.");
        }
      } catch {
        setNote("Couldn't auto-read the invoice — enter fields manually.");
      } finally {
        setExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="mt-2.5 rounded-lg border border-border bg-black/30 p-3">
      <div
        onClick={() => fileRef.current?.click()}
        className="cursor-pointer rounded-lg border border-dashed border-border py-3 text-center text-[11px] text-text-dim hover:border-accent/40"
      >
        <input
          ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {extracting ? "Reading invoice…" : fileName ? `📎 ${fileName}` : "📎 Attach invoice (image/PDF) — Claude reads it"}
      </div>
      {note && <p className="mt-1.5 text-[10px] text-text-faint">{note}</p>}

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <LabeledInput label="Supplier" value={supplier} onChange={setSupplier} placeholder="Distributor name" />
        <LabeledInput label="Purchase date" value={purchaseDate} onChange={setPurchaseDate} placeholder="YYYY-MM-DD" />
        <LabeledNumber label="Units" value={units} onChange={setUnits} />
        <LabeledNumber label="Total $" value={amount} onChange={setAmount} />
      </div>

      <div className="mt-2.5 flex gap-2">
        {inv && (
          <button onClick={onClear} className="rounded-lg border border-border bg-white/5 px-3 py-1.5 text-[11px] text-text-dim hover:text-text">Remove</button>
        )}
        <button
          onClick={() => onSave({ fileName, dataUrl, supplier, purchaseDate, units, amount, addedAt: new Date().toISOString() })}
          className="ml-auto rounded-lg bg-primary px-4 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
        >
          Save invoice
        </button>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-wide text-text-faint">{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-0.5 w-full rounded-md border border-border bg-black/30 px-2 py-1.5 text-[12px] text-text placeholder:text-text-faint outline-none focus:border-accent/50"
      />
    </label>
  );
}

function LabeledNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-wide text-text-faint">{label}</span>
      <input
        type="number" value={value} onChange={(e) => onChange(+e.target.value)}
        className="mt-0.5 w-full rounded-md border border-border bg-black/30 px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent/50"
      />
    </label>
  );
}

function TrackInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-wide text-text-faint">{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-0.5 w-full rounded-md border border-border bg-black/30 px-2 py-1 text-[11px] text-text placeholder:text-text-faint outline-none focus:border-accent/50"
      />
    </label>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-black/20 p-2.5 text-center">
      <div className="text-[9px] uppercase tracking-wide text-text-faint">{label}</div>
      <div className="text-base font-bold" style={{ color: tone ?? "#e8edf4" }}>{value}</div>
    </div>
  );
}
