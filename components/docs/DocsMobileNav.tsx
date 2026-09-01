"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { findDocsPage, findDocsSection } from "@/lib/docs/navigation";

/**
 * Mobile documentation navigation.
 *
 * Below `lg` the sidebar column is hidden, so without this a phone reader has no
 * way to reach any other guide — the previous horizontal pill bar at least
 * scrolled, but it only ever exposed 6 of the 18 pages.
 *
 * The trigger doubles as a "you are here" indicator: it shows the current section
 * and page title, so a reader who scrolled deep into a long guide can still see
 * their position without scrolling back up.
 *
 * Reuses `DocsSidebar` inside the drawer rather than duplicating the tree, so the
 * two viewports can never disagree about what exists.
 */
export function DocsMobileNav() {
  const pathname = usePathname() ?? "/docs";
  const [open, setOpen] = useState(false);

  const page = findDocsPage(pathname);
  const section = findDocsSection(pathname);

  // Close on navigation. Render-time comparison rather than an effect: an effect
  // would paint the open drawer over the new page once first.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="docs-mobile-nav"
        className="surface flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:border-cyan/40"
      >
        <Menu size={16} aria-hidden="true" className="shrink-0 text-cyan" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-micro text-slate-500">
            {section?.label ?? "Documentation"}
          </span>
          <span className="block truncate text-sm font-semibold text-slate-100">
            {page?.label ?? "Browse guides"}
          </span>
        </span>
        <span className="shrink-0 text-xs text-slate-400">All guides</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-overlay">
          <div
            className="animate-overlay-in absolute inset-0 bg-ink/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            id="docs-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Documentation navigation"
            className="animate-slide-in-right absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-slate-800 bg-ink shadow-elevation-4"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
              <span className="text-xs font-bold uppercase tracking-micro text-slate-400">Documentation</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="button-icon">
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <DocsSidebar />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
