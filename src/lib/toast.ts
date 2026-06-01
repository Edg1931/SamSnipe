// Tiny dependency-free toast store. A module-level pub/sub so any component or
// handler can fire a toast via `toast.success(...)` without context plumbing.

export type ToastKind = "success" | "error" | "info";
export interface Toast { id: number; kind: ToastKind; message: string }

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() { for (const l of listeners) l(toasts); }

export function getToasts(): Toast[] { return toasts; }

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string, ttl: number) {
  const id = nextId++;
  toasts = [...toasts, { id, kind, message }];
  emit();
  if (ttl > 0 && typeof window !== "undefined") {
    window.setTimeout(() => dismiss(id), ttl);
  }
  return id;
}

export const toast = {
  success: (m: string) => push("success", m, 3500),
  error: (m: string) => push("error", m, 5500),
  info: (m: string) => push("info", m, 3500),
};
