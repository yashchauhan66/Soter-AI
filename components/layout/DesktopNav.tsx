"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { PRIMARY_NAV, type NavSection } from "@/lib/navigation";

/**
 * Desktop mega-menu navigation.
 *
 * Behaviour notes that matter for accessibility and for not feeling cheap:
 *
 * - The trigger is a real `<button aria-expanded aria-controls>`, not a
 *   hover-only div. Hover-only menus are unreachable by keyboard and unusable
 *   on touch/hybrid laptops.
 * - Hover opens the panel, but closing is delayed. Without the delay the panel
 *   snaps shut while the pointer crosses the gap between trigger and panel,
 *   which is the most common mega-menu defect.
 * - Escape closes; a pointer-down outside closes; moving focus out of the nav
 *   closes. The panel lives in the same DOM subtree as its trigger, so the
 *   natural tab order already reads trigger → panel contents.
 * - Panels are anchored to the header row (`top-full`, full-bleed) so column
 *   layout never shifts depending on which trigger opened it.
 */

const CLOSE_DELAY_MS = 140;

export function DesktopNav() {
  const pathname = usePathname();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idPrefix = useId();

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenLabel(null), CLOSE_DELAY_MS);
  }, [cancelClose]);

  /**
   * Close the panel when the route changes.
   *
   * React's documented "adjusting state when a prop changes" pattern: compare
   * during render and set state immediately, so React re-renders before painting
   * and the stale open panel is never visible.
   *
   * An effect would render the open panel over the new page once first and trips
   * `react-hooks/set-state-in-effect`; a ref is not an option either, since
   * `react-hooks/refs` forbids touching `.current` during render.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (openLabel !== null) setOpenLabel(null);
  }

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    if (!openLabel) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenLabel(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenLabel(null);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openLabel]);

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <div
      ref={containerRef}
      className="hidden lg:flex lg:items-center"
      onMouseLeave={scheduleClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenLabel(null);
      }}
    >
      <nav aria-label="Main" className="flex items-center gap-0.5">
        {PRIMARY_NAV.map((section) => {
          if (section.href) {
            return (
              <Link
                key={section.label}
                href={section.href}
                aria-current={isActive(section.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(section.href)
                    ? "bg-cyan/10 text-white"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
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
                onClick={() => setOpenLabel(open ? null : section.label)}
                onMouseEnter={() => {
                  cancelClose();
                  setOpenLabel(section.label);
                }}
                onFocus={() => {
                  cancelClose();
                  setOpenLabel(section.label);
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  open ? "bg-slate-800/70 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                {section.label}
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              {open && (
                <MegaPanel
                  id={panelId}
                  section={section}
                  onMouseEnter={cancelClose}
                  onNavigate={() => setOpenLabel(null)}
                />
              )}
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
  onMouseEnter,
  onNavigate,
}: {
  id: string;
  section: NavSection;
  onMouseEnter: () => void;
  onNavigate: () => void;
}) {
  const hasFeature = Boolean(section.feature);

  return (
    <div
      id={id}
      onMouseEnter={onMouseEnter}
      className="animate-slide-down absolute left-0 right-0 top-full z-drawer border-b border-slate-800/70 bg-ink/95 backdrop-blur-xl"
    >
      <div
        className={`container-page grid gap-8 py-8 ${
          hasFeature ? "lg:grid-cols-[1fr_1fr_20rem]" : "lg:grid-cols-2"
        }`}
      >
        {section.groups?.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-bold uppercase tracking-micro text-slate-400">{group.label}</p>
            {group.caption && <p className="mt-1 text-xs text-slate-500">{group.caption}</p>}

            <ul className="mt-4 space-y-1">
              {group.links.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      className="group flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-slate-800/60"
                    >
                      {Icon && (
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/70 text-slate-300 transition-colors group-hover:border-cyan/40 group-hover:text-cyan">
                          <Icon size={16} aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                          {link.label}
                          {link.tag && <span className="badge-neutral !px-1.5 !py-0 !text-[10px]">{link.tag}</span>}
                        </span>
                        {link.desc && (
                          <span className="mt-0.5 block text-xs leading-5 text-slate-400">{link.desc}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {section.feature && (
          <Link
            href={section.feature.href}
            onClick={onNavigate}
            className="group flex flex-col justify-between rounded-panel border border-cyan/20 bg-cyan/[0.06] p-5 transition-colors hover:border-cyan/40 hover:bg-cyan/10"
          >
            <div>
              <p className="eyebrow">{section.feature.eyebrow}</p>
              <p className="mt-2 text-base font-semibold text-white">{section.feature.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{section.feature.copy}</p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
              {section.feature.cta}
              <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

