"use client";

// Functional left-rail navigation — each item opens the matching view/panel.
const NAV: { key: string; label: string; icon: string }[] = [
  { key: "deals", label: "Live Deals", icon: "M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" },
  { key: "autopilot", label: "Auto-Pilot", icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z" },
  { key: "optimizer", label: "Optimizer", icon: "M3 3v18h18M7 14l3-4 3 3 4-6" },
  { key: "buylist", label: "Buy List", icon: "M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" },
  { key: "scan", label: "Shelf Scan", icon: "M3 7h3l2-2h8l2 2h3v12H3z" },
  { key: "sources", label: "Sources", icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 2.5 15 0 18" },
  { key: "approvals", label: "Approvals", icon: "M7.5 15.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm3.2-3.2L19 4m-3 0h3v3" },
];

export function Sidebar({
  active = "deals",
  onNavigate,
}: {
  active?: string;
  onNavigate: (key: string) => void;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-bg-elev/60 px-3 py-5 lg:flex">
      <button onClick={() => onNavigate("deals")} className="flex items-center gap-2.5 px-2 text-left">
        <Logo />
        <div>
          <div className="text-[15px] font-bold tracking-tight text-text">SamSnipe</div>
          <div className="text-[10px] text-text-faint">AI Resale Sourcing</div>
        </div>
      </button>

      <nav className="mt-7 space-y-1">
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => onNavigate(n.key)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
              active === n.key ? "bg-accent/10 text-accent" : "text-text-dim hover:bg-white/5 hover:text-text"
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
          Keepa + AI web search, hunting Amazon US flips.
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
