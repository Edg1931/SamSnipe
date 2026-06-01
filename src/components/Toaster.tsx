"use client";

import { useEffect, useState } from "react";
import { subscribe, dismiss, getToasts, type Toast, type ToastKind } from "@/lib/toast";

const STYLE: Record<ToastKind, { color: string; icon: string }> = {
  success: { color: "#10d98e", icon: "✓" },
  error: { color: "#f4476b", icon: "!" },
  info: { color: "#38bdf8", icon: "i" },
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>(getToasts);
  useEffect(() => subscribe(setToasts), []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => {
        const s = STYLE[t.kind];
        return (
          <div
            key={t.id}
            className="glass animate-rise pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-border px-4 py-2.5 text-[13px] shadow-2xl"
            style={{ borderColor: `${s.color}55` }}
            role="status"
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-black" style={{ background: s.color }}>{s.icon}</span>
            <span className="flex-1 text-text">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="shrink-0 text-text-faint hover:text-text" aria-label="Dismiss">✕</button>
          </div>
        );
      })}
    </div>
  );
}
