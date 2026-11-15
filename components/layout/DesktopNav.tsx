"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { PRIMARY_NAV, activeSectionLabel, navCurrent, type NavSection } from "@/lib/navigation";

/**
 * Desktop navigation.
 *
 * Behaviour that matters for accessibility, and that is kept from the previous
 * version:
 *  - The trigger is a real <button aria-expanded aria-controls>, not a hover-only
 *    div, so it works by keyboard and on touch laptops.
 *  - Hover opens a panel, but closing is delayed. Without the delay the panel snaps
 *    shut while the pointer crosses the gap between trigger and panel.
 *  - Escape closes. A pointer-down outside closes. Moving focus out closes.
 *  - The panel closes when the route changes.
 *
 * What changed, and why:
 *  - Panels are ALWAYS in the DOM and hidden with the `hidden` attribute until
 *    opened. Before, `{open && <MegaPanel/>}` mounted a panel only on interaction,
 *    so its links were never in the server HTML. A crawl of the live site found ten
 *    pages with no link from any page's HTML. Rendering the panels (hidden) fixes
 *    that without changing what a visitor sees.
 */

const CLOSE_DELAY_MS = 140;

export function DesktopNav() {
  const pathname = usePathname();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  // "Pinned" means the visitor clicked (or pressed Enter) to keep the panel open.
  // A panel opened only by hover or focus is not pinned and closes when the pointer
  // or focus leaves. Without this, hovering a trigger opened the panel and the click
  // that followed toggled it shut again.
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idPrefix = useId();

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    setOpenLabel(null);
    setPinned(false);
  }, []);

  // A pinned panel stays open until Escape, a second click or an outside click, so
  // the delayed close does nothing while `pinned` is true. `pinned` is a dependency
  // so the callback always sees the current value.
  const scheduleClose = useCallback(() => {
    cancelClose();
    if (pinned) return;
    closeTimer.current = setTimeout(() => setOpenLabel(null), CLOSE_DELAY_MS);
  }, [cancelClose, pinned]);

  // Close when the route changes. React's documented "adjust state while rendering"
  // pattern, so the stale open panel is never painted over the new page.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (openLabel !== null) {
      setOpenLabel(null);
      setPinned(false);
    }
  }

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (!openLabel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openLabel, close]);

  // One owner at most; see activeSectionLabel in lib/navigation.ts.
  const activeLabel = activeSectionLabel(pathname);

  const itemClass = (active: boolean, open = false) =>
    `inline-flex items-center gap-1 rounded-md px-3 py-2 font-mono text-[0.8125rem] font-semibold tracking-tight transition-colors ${
      open || active ? "bg-slate-900 text-slate-100" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
    }`;

  return (
    <div
      ref={containerRef}
      className="hidden lg:flex lg:items-center"
      onMouseLeave={scheduleClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <nav aria-label="Main" className="flex items-center gap-0.5">
        {PRIMARY_NAV.map((section) => {
          if (section.href) {
            return (
              <Link
                key={section.label}
                href={section.href}
                aria-current={navCurrent(pathname, section.href)}
                className={itemClass(activeLabel === section.label)}
              >
                {section.label}
              </Link>
            );
          }

          const panelId = `${idPrefix}-${section.label.toLowerCase()}`;
          const open = openLabel === section.label;

          return (
            <div key={section.label} className="static">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => {
                  cancelClose();
                  // First click pins an open panel; clicking again closes it.
                  if (open && pinned) {
                    close();
                  } else {
                    setOpenLabel(section.label);
                    setPinned(true);
                  }
                }}
                onMouseEnter={() => {
                  cancelClose();
                  // Hovering a different trigger switches panels and drops any pin.
                  if (openLabel !== section.label) setPinned(false);
                  setOpenLabel(section.label);
                }}
                onFocus={() => {
                  cancelClose();
                  if (openLabel !== section.label) setPinned(false);
                  setOpenLabel(section.label);
                }}
                className={itemClass(activeLabel === section.label, open)}
              >
                {section.label}
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              <MegaPanel
                id={panelId}
                section={section}
                open={open}
                onMouseEnter={cancelClose}
                onNavigate={close}
              />
            </div>
          );
        })}
      </nav>
    </div>
  );
}

function MegaPanel({
  id,
  section,
  open,
  onMouseEnter,
  onNavigate,
}: {
  id: string;
  section: NavSection;
  open: boolean;
  onMouseEnter: () => void;
  onNavigate: () => void;
}) {
  const hasFeature = Boolean(section.feature);

  return (
    <div
      id={id}
      hidden={!open}
      onMouseEnter={onMouseEnter}
      className="animate-slide-down absolute left-0 right-0 top-full z-drawer border-b border-slate-800 bg-slate-950 shadow-elevation-3"
    >
      <div
        className={`container-page grid gap-8 py-8 ${
          hasFeature ? "lg:grid-cols-[1fr_1fr_20rem]" : "lg:grid-cols-2"
        }`}
      >
        {section.groups?.map((group) => (
          <div key={group.label}>
            <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-micro text-slate-500">
              {group.label}
            </p>
            {group.caption && <p className="mt-1 text-xs text-slate-500">{group.caption}</p>}

            <ul className="mt-4 space-y-0.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    tabIndex={open ? 0 : -1}
                    className="group block rounded-md px-3 py-2.5 transition-colors hover:bg-slate-900"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      {link.label}
                      {link.tag && <span className="badge-neutral !px-1.5 !py-0 !text-[10px]">{link.tag}</span>}
                    </span>
                    {link.desc && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{link.desc}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {section.feature && (
          <Link
            href={section.feature.href}
            onClick={onNavigate}
            tabIndex={open ? 0 : -1}
            className="group flex flex-col justify-between rounded-panel border border-slate-800 bg-white p-5 shadow-elevation-1 transition-shadow hover:shadow-elevation-3"
          >
            <div>
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-micro text-cyan">
                {section.feature.eyebrow}
              </p>
              <p className="mt-2 font-display text-lg font-semibold text-slate-100">{section.feature.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{section.feature.copy}</p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-[0.8125rem] font-semibold text-cyan">
              {section.feature.cta}
              <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
