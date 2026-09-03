"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronDown, LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { MOBILE_SHORTCUTS, PRIMARY_NAV } from "@/lib/navigation";

/**
 * Mobile / tablet navigation drawer.
 *
 * Reads the same `PRIMARY_NAV` tree as the desktop mega menu, so the two
 * surfaces can no longer drift apart — this file previously kept its own
 * six-item list that omitted Pricing, Enterprise, Trust, and every product page.
 *
 * Accessibility details:
 * - `role="dialog" aria-modal` plus a focus trap, so keyboard and screen-reader
 *   users cannot wander into the page behind the overlay.
 * - Body scroll is locked while open and the *original* overflow value is
 *   restored on close, rather than being hard-reset to "".
 * - Sections use React state with `aria-expanded` so their collapsed status is
 *   announced, which a bare `<details>` inside a dialog does less reliably.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(PRIMARY_NAV[0]?.label ?? null);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const signedIn = status === "authenticated" && Boolean(session?.user);
  const isAdmin = Boolean(session?.user?.isAdmin);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);

  /**
   * Close the drawer when the route changes — including in-page anchor
   * navigations, which a router event listener alone would miss.
   *
   * This is React's documented "adjusting state when a prop changes" pattern:
   * compare during render and set state immediately. React discards the
   * in-progress render and re-runs with the new value before painting, so the
   * drawer never flashes over the newly rendered page.
   *
   * An effect would work too, but it renders the stale open drawer once first and
   * trips `react-hooks/set-state-in-effect`. A ref cannot be used here either —
   * `react-hooks/refs` forbids reading or writing `.current` during render.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  // Lock scroll while open; restore focus to the trigger on close.
  useEffect(() => {
    if (!open) {
      openButtonRef.current?.focus();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Escape closes; Tab cycles within the panel.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const dashboardHref = isAdmin ? "/admin" : "/dashboard";
  const dashboardLabel = isAdmin ? "Admin" : "Dashboard";
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label="Open navigation menu"
        className="button-icon lg:hidden"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-overlay lg:hidden">
          <div
            className="animate-overlay-in absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="animate-slide-in-right absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-slate-800 bg-ink shadow-elevation-4"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-4">
              <span className="text-xs font-bold uppercase tracking-micro text-slate-400">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="button-icon"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Shortcut row: the five destinations that answer "can I try it?"
                without making the visitor expand a section first. */}
            <div className="grid shrink-0 grid-cols-5 divide-x divide-slate-800 border-b border-slate-800">
              {MOBILE_SHORTCUTS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center gap-1 px-1 py-3 text-center text-[10px] font-medium text-slate-300 transition-colors hover:bg-slate-900 hover:text-cyan"
                  >
                    {Icon && <Icon size={16} aria-hidden="true" />}
                    {item.label}
                  </Link>
                );
              })}
            </div>


            <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile">
              <ul className="space-y-1">
                {PRIMARY_NAV.map((section) => {
                  if (section.href) {
                    return (
                      <li key={section.label}>
                        <Link
                          href={section.href}
                          onClick={() => setOpen(false)}
                          aria-current={isActive(section.href) ? "page" : undefined}
                          className={`block rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${
                            isActive(section.href) ? "bg-cyan/10 text-cyan" : "text-slate-100 hover:bg-slate-900"
                          }`}
                        >
                          {section.label}
                        </Link>
                      </li>
                    );
                  }

                  const isExpanded = expanded === section.label;
                  const sectionId = `mobile-nav-${section.label.toLowerCase()}`;

                  return (
                    <li key={section.label}>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={sectionId}
                        onClick={() => setExpanded(isExpanded ? null : section.label)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-900"
                      >
                        {section.label}
                        <ChevronDown
                          size={15}
                          aria-hidden="true"
                          className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isExpanded && (
                        <div id={sectionId} className="animate-slide-down space-y-4 pb-3 pl-2 pt-1">
                          {section.groups?.map((group) => (
                            <div key={group.label}>
                              <p className="px-3 text-[10px] font-bold uppercase tracking-micro text-slate-500">
                                {group.label}
                              </p>
                              <ul className="mt-1">
                                {group.links.map((link) => {
                                  const Icon = link.icon;
                                  const active = isActive(link.href);
                                  return (
                                    <li key={link.href}>
                                      <Link
                                        href={link.href}
                                        onClick={() => setOpen(false)}
                                        aria-current={active ? "page" : undefined}
                                        className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                                          active ? "bg-cyan/10" : "hover:bg-slate-900"
                                        }`}
                                      >
                                        {Icon && (
                                          <Icon
                                            size={16}
                                            aria-hidden="true"
                                            className={`mt-0.5 shrink-0 ${active ? "text-cyan" : "text-slate-400"}`}
                                          />
                                        )}
                                        <span className="min-w-0">
                                          <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
                                            {link.label}
                                            {link.tag && (
                                              <span className="badge-neutral !px-1.5 !py-0 !text-[10px]">
                                                {link.tag}
                                              </span>
                                            )}
                                          </span>
                                          {link.desc && (
                                            <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                                              {link.desc}
                                            </span>
                                          )}
                                        </span>
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>


            <div className="shrink-0 border-t border-slate-800 px-4 py-4">
              {signedIn ? (
                <div className="space-y-2">
                  <Link href={dashboardHref} onClick={() => setOpen(false)} className="button-primary w-full">
                    <LayoutDashboard size={16} aria-hidden="true" /> {dashboardLabel}
                  </Link>
                  {session?.user?.email && (
                    <p className="truncate text-center text-xs text-slate-400">{session.user.email}</p>
                  )}
                  <div className="flex justify-center">
                    <SignOutButton />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link href="/signup" onClick={() => setOpen(false)} className="button-primary w-full">
                    Create free account
                  </Link>
                  <Link href="/signin" onClick={() => setOpen(false)} className="button-secondary w-full">
                    <LogIn size={15} aria-hidden="true" /> Sign in
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

