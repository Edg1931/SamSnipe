"use client";

// Route error boundary — if anything in the dashboard throws at render, show a
// recoverable screen instead of a dead, non-interactive page.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div className="max-w-sm">
        <div className="text-4xl">🎯</div>
        <h1 className="mt-3 text-lg font-semibold text-text">Something hiccuped</h1>
        <p className="mt-1 text-[13px] text-text-dim">
          SamSnipe hit a snag rendering this view. Your saved data is safe — try reloading the feed.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-black hover:opacity-90"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
