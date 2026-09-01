"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Check } from "lucide-react";
import { DOCS_HELP_LINKS, DOCS_SECTIONS } from "@/lib/docs/navigation";

/**
 * Persistent documentation sidebar.
 *
 * Replaces the 6-item horizontal pill bar that hid 12 of the 18 guides. The full
 * tree is always visible, so a reader on any page can see what else exists —
 * which is the single biggest difference between a docs site and a pile of pages.
 *
 * Notes:
 * - Sections are always expanded. Collapsible groups save vertical space but cost
 *   a click *and* hide the thing the reader is scanning for; at 18 entries the
 *   whole tree fits in one scroll, so there is nothing to gain.
 * - `aria-current="page"` marks the active entry, and the active state uses a
 *   left rule plus colour rather than colour alone (1.4.1 Use of Colour).
 * - Rendered inside a `lg:sticky` column by the layout; this component owns only
 *   its own scrolling.
 */
export function DocsSidebar() {
  const pathname = usePathname() ?? "/docs";

  return (
    <nav aria-label="Documentation" className="text-sm">
      <div className="space-y-7">
        {DOCS_SECTIONS.map((section) => {
          const SectionIcon = section.icon;

          return (
            <div key={section.id}>
              <div className="flex items-center gap-2 px-2">
                <SectionIcon size={14} aria-hidden="true" className="shrink-0 text-cyan" />
                <h2 className="text-xs font-bold uppercase tracking-micro text-slate-200">{section.label}</h2>
              </div>
              <p className="mt-1 px-2 pl-[1.6rem] text-xs leading-5 text-slate-500">{section.caption}</p>

              <ul className="mt-2.5 space-y-0.5">
                {section.pages.map((page) => {
                  const active = pathname === page.href;

                  return (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-between gap-2 rounded-md border-l-2 py-1.5 pl-3 pr-2 transition-colors ${
                          active
                            ? "border-cyan bg-cyan/10 font-semibold text-white"
                            : "border-transparent text-slate-400 hover:border-slate-600 hover:bg-slate-900/60 hover:text-slate-100"
                        }`}
                      >
                        <span className="min-w-0 truncate">{page.label}</span>
                        <span
                          data-numeric
                          className={`shrink-0 text-[10px] tabular-nums ${active ? "text-cyan" : "text-slate-600"}`}
                        >
                          {page.minutes}m
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-8 space-y-1 border-t border-slate-800 pt-5">
        {DOCS_HELP_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-slate-400 transition-colors hover:bg-slate-900/60 hover:text-cyan"
            >
              <Icon size={14} aria-hidden="true" className="shrink-0" />
              {link.label}
              <ArrowUpRight size={12} aria-hidden="true" className="ml-auto shrink-0 opacity-60" />
            </Link>
          );
        })}
      </div>

      {/* Honest scope note. Readers arriving from a search engine often assume a
          security product claims total coverage; saying otherwise here costs
          nothing and prevents a misinformed integration. */}
      <p className="mt-6 flex gap-2 px-3 text-xs leading-5 text-slate-500">
        <Check size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-600" />
        Every guide states what it does <em className="not-italic text-slate-400">and</em> does not cover.
      </p>
    </nav>
  );
}
