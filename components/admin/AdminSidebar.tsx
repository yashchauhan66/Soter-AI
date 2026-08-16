"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, ShieldAlert, X } from "lucide-react";
import {
  ADMIN_NAV,
  type AdminBadgeCounts,
  type AdminNavItem,
  isAdminNavActive,
  openAdminCommandPalette,
} from "./adminNav";

export type { AdminBadgeCounts } from "./adminNav";

function NavLink({
  item,
  counts,
  pathname,
  onNavigate,
}: {
  item: AdminNavItem;
  counts: AdminBadgeCounts;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const active = isAdminNavActive(pathname, item.href);
  const count = item.badge ? counts[item.badge.key] : 0;
  const showBadge = Boolean(item.badge) && count > 0;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-cyan/10 font-semibold text-cyan"
          : "text-slate-200 hover:bg-slate-800/50 hover:text-slate-100"
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-cyan transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
      <Icon size={16} className={active ? "text-cyan" : "text-slate-300 group-hover:text-slate-300"} />
      <span className="flex-1 truncate">{item.label}</span>
      {showBadge && (
        <span
          className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${
            item.badge!.tone === "red"
              ? "bg-red-500/20 text-red-200"
              : "bg-amber-500/20 text-amber-200"
          }`}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

export function AdminSidebar({ counts, adminEmail }: { counts: AdminBadgeCounts; adminEmail: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const urgent =
    counts.failedJobs24h + counts.lockedOrgs + counts.pendingApprovals + counts.openTickets;

  const nav = (
    <nav className="flex flex-col gap-6" aria-label="Admin navigation">
      {ADMIN_NAV.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <NavLink
                key={`${group.title}-${item.href}-${item.label}`}
                item={item}
                counts={counts}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 px-3">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan/15 text-cyan">
        <ShieldAlert size={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-100">SoterAI Admin</p>
        <p className="truncate text-[11px] text-slate-300">Command center</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-ink/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
            <ShieldAlert size={16} />
          </span>
          <span className="text-sm font-bold">SoterAI Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAdminCommandPalette}
            aria-label="Search admin services"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-cyan/60"
          >
            <Search size={17} />
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin navigation"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-900/70 text-slate-200 hover:border-cyan/60"
          >
            <Menu size={18} />
            {urgent > 0 && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-400 ring-2 ring-ink" />
            )}
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col border-r border-slate-800 bg-panel/40 lg:flex">
        <div className="flex items-center justify-between border-b border-slate-800 py-5">
          {brand}
        </div>
        <div className="px-3 pt-4">
          <button
            type="button"
            onClick={openAdminCommandPalette}
            className="group flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-cyan/40 hover:text-slate-200"
          >
            <Search size={15} className="text-slate-300 group-hover:text-cyan" />
            <span className="flex-1 truncate">Search services...</span>
            <kbd className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">Ctrl K</kbd>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">{nav}</div>
        <div className="border-t border-slate-800 px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Internal - use carefully</p>
          <p className="mt-1 truncate text-xs text-slate-300" title={adminEmail}>
            {adminEmail}
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute left-0 top-0 flex h-full w-[280px] flex-col border-r border-slate-800 bg-panel shadow-glow">
            <div className="flex items-center justify-between border-b border-slate-800 py-5 pr-3">
              {brand}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close admin navigation"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan/60"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-5">{nav}</div>
            <div className="border-t border-slate-800 px-4 py-4">
              <p className="truncate text-xs text-slate-300" title={adminEmail}>
                {adminEmail}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
