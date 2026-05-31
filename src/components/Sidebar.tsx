"use client";

const NAV = [
  { key: "deals", label: "Live Deals", icon: "M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" },
  { key: "buylist", label: "Buy List", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
  { key: "scans", label: "Scans", icon: "M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.35-4.35" },
  { key: "risk", label: "Risk Radar", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  { key: "watchlist", label: "Watchlist", icon: "M12 2l3 7 7 .5-5.5 4.5L18 21l-6-3.5L6 21l1.5-7L2 9.5 9 9z" },
];

export function Sidebar({ active = "deals" }: { active?: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-bg-elev/60 px-3 py-5 lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <Logo />
        <div>
          <div className="text-[15px] font-bold tracking-tight text-text">SamSnipe</div>
          <div className="text-[10px] text-text-faint">AI Resale Sourcing</div>
        </div>
      </div>

      <nav className="mt-7 space-y-1">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
              active === n.key
                ? "bg-accent/10 text-accent"
                : "text-text-dim hover:bg-white/5 hover:text-text"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={n.icon} />
            </svg>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto rounded-xl border border-border bg-black/20 p-3">
        <div className="flex items-center gap-2 text-[11px] font-medium text-text">
          <span className="pulse-dot h-2 w-2 rounded-full bg-accent" />
          Agent online
        </div>
        <p className="mt-1 text-[10px] leading-snug text-text-dim">
          Scanning 9 sources every 30 min for Amazon US flips.
        </p>
      </div>
    </aside>
  );
}

function Logo() {
  return (
    <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10d98e" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3M12 20v3M1 12h3M20 12h3" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1.2" fill="#10d98e" stroke="none" />
      </svg>
    </div>
  );
}
