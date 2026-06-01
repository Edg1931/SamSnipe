"use client";

// Functional left-rail navigation — each item opens the matching view/panel.
// On desktop this is the single source of navigation (the header no longer
// duplicates it).
const NAV: { key: string; label: string; icon: string }[] = [
  { key: "home", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h14V10" },
  { key: "deals", label: "Live Deals", icon: "M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" },
  { key: "autopilot", label: "Auto-Pilot", icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z" },
  { key: "buylist", label: "Buy List", icon: "M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" },
  { key: "optimizer", label: "Optimizer", icon: "M3 3v18h18M7 14l3-4 3 3 4-6" },
  { key: "scan", label: "Shelf Scan", icon: "M3 7h3l2-2h8l2 2h3v12H3z" },
  { key: "import", label: "Import / Manifest", icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" },
  { key: "sources", label: "Sources", icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 2.5 15 0 18" },
  { key: "approvals", label: "Approvals", icon: "M7.5 15.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm3.2-3.2L19 4m-3 0h3v3" },
  { key: "brands", label: "Exempt brands", icon: "M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.59 11l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.59zM7 7h.01" },
  { key: "setup", label: "Setup", icon: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" },
];

export function Sidebar({
  active = "deals",
  onNavigate,
  badges = {},
}: {
  active?: string;
  onNavigate: (key: string) => void;
  badges?: Record<string, number | string | undefined>;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-bg-elev/60 px-3 py-5 lg:flex">
      <button onClick={() => onNavigate("home")} className="flex items-center gap-2.5 px-2 text-left">
        <Logo />
        <div>
          <div className="text-[15px] font-bold tracking-tight text-text">SamSnipe</div>
          <div className="text-[10px] text-text-faint">AI Resale Sourcing</div>
        </div>
      </button>

      <nav className="mt-7 space-y-1">
        {NAV.map((n) => {
          const badge = badges[n.key];
          const isActive = active === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onNavigate(n.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                isActive ? "bg-primary/15 text-primary" : "text-text-dim hover:bg-white/5 hover:text-text"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon} />
              </svg>
              <span className="flex-1 text-left">{n.label}</span>
              {badge != null && badge !== 0 && badge !== "" && (
                <span className={`rounded-md px-1.5 text-[10px] font-semibold ${isActive ? "bg-primary/20 text-primary" : "bg-white/5 text-text-faint"}`}>{badge}</span>
              )}
            </button>
          );
        })}
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
