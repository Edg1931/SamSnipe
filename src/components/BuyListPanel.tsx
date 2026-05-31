"use client";

import type { BuyItem, BuyStatus } from "@/lib/buylist";
import { computeTotals } from "@/lib/buylist";
import { usd } from "@/lib/format";
import { resolveSourceUrl, amazonUrl } from "@/lib/links";

const STATUSES: BuyStatus[] = ["to_buy", "ordered", "received"];
const STATUS_LABEL: Record<BuyStatus, string> = {
  to_buy: "To buy", ordered: "Ordered", received: "Received",
};

// The buy list: committed deals with quantities, status, and live ROI tracking.
export function BuyListPanel({
  items, onChange, onClose,
}: {
  items: BuyItem[];
  onChange: (items: BuyItem[]) => void;
  onClose: () => void;
}) {
  const t = computeTotals(items);

  const setQty = (id: string, qty: number) =>
    onChange(items.map((i) => (i.deal.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
  const setStatus = (id: string, status: BuyStatus) =>
    onChange(items.map((i) => (i.deal.id === id ? { ...i, status } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.deal.id !== id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="glass animate-rise relative h-full w-full max-w-lg overflow-y-auto border-l border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Buy list & ROI tracker</h2>
            <p className="text-[11px] text-text-dim">Everything you&apos;ve committed to source.</p>
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

        {items.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border py-12 text-center text-[12px] text-text-dim">
            Your buy list is empty. Open a deal and hit <span className="text-accent">Add to buy list</span>.
          </p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {items.map((i) => {
              const az = amazonUrl(i.deal.match.asin);
              const src = resolveSourceUrl({ source: i.deal.source, title: i.deal.title, sourceUrl: i.deal.sourceUrl });
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
                    {/* qty stepper */}
                    <div className="flex items-center rounded-lg border border-border bg-black/30">
                      <button onClick={() => setQty(i.deal.id, i.qty - 1)} className="px-2 py-1 text-text-dim hover:text-text">−</button>
                      <span className="min-w-7 text-center text-[12px] text-text">{i.qty}</span>
                      <button onClick={() => setQty(i.deal.id, i.qty + 1)} className="px-2 py-1 text-text-dim hover:text-text">+</button>
                    </div>
                    {/* status */}
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

                  <div className="mt-2 flex gap-3 text-[10px]">
                    <a href={src} target="_blank" rel="noopener noreferrer" className="text-text-dim hover:text-text">View on {i.deal.source} ↗</a>
                    {az && <a href={az} target="_blank" rel="noopener noreferrer" className="text-text-dim hover:text-text">Amazon ↗</a>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
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
