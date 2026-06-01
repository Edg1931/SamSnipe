// Shimmer placeholders shown while deals load — used by the feed and home so
// both feel responsive instead of flashing empty.

export function DealCardSkeleton() {
  return (
    <div className="glass animate-pulse rounded-2xl border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 rounded-xl bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-3/4 rounded bg-white/5" />
          <div className="h-2.5 w-1/2 rounded bg-white/5" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-black/20 p-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2 w-8 rounded bg-white/5" />
            <div className="h-3 w-10 rounded bg-white/10" />
          </div>
        ))}
      </div>
      <div className="mt-3 h-2.5 w-2/3 rounded bg-white/5" />
      <div className="mt-3 h-px w-full bg-border-soft" />
      <div className="mt-2.5 h-2.5 w-1/2 rounded bg-white/5" />
    </div>
  );
}

export function DealGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => <DealCardSkeleton key={i} />)}
    </div>
  );
}
