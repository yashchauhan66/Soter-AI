"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Search } from "lucide-react";
import {
  ADMIN_NAV,
  type AdminBadgeCounts,
  openAdminCommandPalette,
} from "./adminNav";

/**
 * Front-page launcher for every admin service. Renders directly from the
 * ADMIN_NAV registry so it can never drift from the sidebar / command palette,
 * surfaces live attention badges so the services that need action stand out,
 * and offers an in-place filter for jump-to-anything without leaving the page.
 */
export function AdminServiceLauncher({ counts }: { counts: AdminBadgeCounts }) {
  const [query, setQuery] = useState("");

  const totalServices = useMemo(
    () => ADMIN_NAV.reduce((sum, group) => sum + group.items.length, 0),
    [],
  );

  const attentionCount = useMemo(
    () =>
      ADMIN_NAV.reduce((sum, group) => {
        return (
          sum +
          group.items.filter((item) => item.badge && counts[item.badge.key] > 0).length
        );
      }, 0),
    [counts],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ADMIN_NAV;
    return ADMIN_NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const haystack = [item.label, item.hint, group.title, ...(item.keywords ?? [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      }),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  const hasResults = groups.some((group) => group.items.length > 0);

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">All services</p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold">
            <LayoutGrid size={18} className="text-cyan" />
            Service launcher
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {totalServices} services in one click
            {attentionCount > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-amber-300">
                  {attentionCount} need attention
                </span>
              </>
            )}
          </p>
        </div>
        <div className="relative sm:w-72">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter services…"
            aria-label="Filter admin services"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/70 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-300 focus:border-cyan/50"
          />
        </div>
      </div>

      {hasResults ? (
        <div className="mt-5 space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                {group.title}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const count = item.badge ? counts[item.badge.key] : 0;
                  const showBadge = Boolean(item.badge) && count > 0;
                  const red = item.badge?.tone === "red";
                  return (
                    <Link
                      key={`${group.title}-${item.href}-${item.label}`}
                      href={item.href}
                      className={`group relative flex items-start gap-3 rounded-xl border bg-slate-950/40 p-3.5 transition hover:-translate-y-0.5 hover:bg-slate-900/60 ${
                        showBadge
                          ? red
                            ? "border-red-500/40 hover:border-red-400/70"
                            : "border-amber-500/30 hover:border-amber-400/60"
                          : "border-slate-800 hover:border-cyan/40"
                      }`}
                    >
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                          showBadge
                            ? red
                              ? "bg-red-500/10 text-red-300"
                              : "bg-amber-500/10 text-amber-300"
                            : "bg-slate-900 text-slate-200 group-hover:bg-cyan/10 group-hover:text-cyan"
                        }`}
                      >
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {item.label}
                          </p>
                          {showBadge && (
                            <span
                              className={`ml-auto min-w-[20px] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${
                                red
                                  ? "bg-red-500/20 text-red-200"
                                  : "bg-amber-500/20 text-amber-200"
                              }`}
                            >
                              {count > 99 ? "99+" : count}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-300">
                          {item.hint}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-8 text-center">
          <p className="text-sm text-slate-200">
            No service matches “{query}”.
          </p>
          <button
            type="button"
            onClick={openAdminCommandPalette}
            className="text-sm font-semibold text-cyan hover:text-cyan/80"
          >
            Search everything with ⌘K
          </button>
        </div>
      )}
    </section>
  );
}
