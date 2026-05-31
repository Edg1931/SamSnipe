"use client";

import type { ReactNode } from "react";

// Mobile-only bottom tab bar — the primary nav on phones (sidebar is desktop).
export function BottomNav({
  mode, findingsCount, onNavigate,
}: {
  mode: "home" | "feed";
  findingsCount: number;
  onNavigate: (key: string) => void;
}) {
  const items: { key: string; label: string; icon: ReactNode; active: boolean; badge?: number }[] = [
    { key: "home", label: "Home", icon: <HomeIcon />, active: mode === "home" },
    { key: "deals", label: "Deals", icon: <GridIcon />, active: mode === "feed" },
    { key: "autopilot", label: "Auto", icon: <BoltIcon />, active: false, badge: findingsCount },
    { key: "buylist", label: "Buy List", icon: <CartIcon />, active: false },
    { key: "copilot", label: "Copilot", icon: <SparkIcon />, active: false },
  ];
  return (
    <nav className="glass fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-border pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onNavigate(it.key)}
          className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
            it.active ? "text-accent" : "text-text-dim"
          }`}
        >
          <span className="relative">
            {it.icon}
            {it.badge != null && it.badge > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-black">
                {it.badge > 9 ? "9+" : it.badge}
              </span>
            )}
          </span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}

function HomeIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>;
}
function GridIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" /></svg>;
}
function BoltIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>;
}
function CartIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" /></svg>;
}
function SparkIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 6.9L21 11l-6.6 2.1L12 20l-2.4-6.9L3 11l6.6-2.1L12 2z" /></svg>;
}
