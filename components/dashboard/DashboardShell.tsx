"use client";

import { useEffect, useState } from "react";
import { Menu, PanelLeftClose, X } from "lucide-react";
import { DashboardSidebar } from "./DashboardSidebar";
import { CommandPalette } from "./CommandPalette";
import { FeedbackWidget } from "@/components/ops/FeedbackWidget";
import { DashboardTourProvider } from "@/components/onboarding/DashboardTourProvider";
import { TourOverlay } from "@/components/onboarding/TourOverlay";
import { TourTrigger } from "@/components/onboarding/TourTrigger";

/**
 * Dashboard shell: sidebar + content column.
 *
 * Changes from the previous version:
 *
 * - **The sidebar is sticky.** It was a static grid column, so on a long page
 *   (Logs, Escrow, Agent Firewall) the whole navigation scrolled off screen and
 *   the operator had to scroll back to the top to switch section. It now sticks
 *   below the site header with its own overflow.
 * - **The column is wider** (208px → 248px). At 208px, entries like
 *   "Data classification" and "Employee monitoring" truncated mid-word, so a
 *   reader could not tell two similar items apart without hovering.
 * - **The mobile drawer is a real dialog** with `role="dialog" aria-modal`, a
 *   focus trap, and body-scroll lock. Previously it was a `translate-x` panel
 *   that left the page behind it focusable and scrollable, so a keyboard user
 *   could Tab straight out of an open drawer into hidden content.
 * - **The mobile header says where you are.** It read a hard-coded
 *   "Security team", which is not navigation information.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Escape closes; Tab is trapped inside the drawer while it is open.
  useEffect(() => {
    if (!sidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const panel = document.getElementById("dashboard-mobile-nav");
      const focusable = panel?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);

  return (
    <DashboardTourProvider>
      <div className="container-page py-4 sm:py-8">
        {/* Mobile navigation trigger */}
        <div className="mb-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-mobile-nav"
            className="surface flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:border-cyan/40"
          >
            <Menu size={17} aria-hidden="true" className="shrink-0 text-cyan" />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-micro text-slate-500">
                SoterAI console
              </span>
              <span className="block text-sm font-semibold text-slate-100">Browse all sections</span>
            </span>
          </button>
        </div>

        <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8">
          {/* Desktop sidebar — sticky, independently scrollable. */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
              <DashboardSidebar />
            </div>
          </aside>

          {/* `min-w-0` stops a wide table or <pre> from expanding the grid track
              and pushing the sidebar off screen. */}
          <section className="min-w-0">{children}</section>
        </div>

        <FeedbackWidget />
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-overlay lg:hidden">
          <div
            className="animate-overlay-in absolute inset-0 bg-ink/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />

          <div
            id="dashboard-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
            className="animate-slide-in-right absolute inset-y-0 right-0 flex w-full max-w-[300px] flex-col border-l border-slate-800 bg-ink shadow-elevation-4"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-micro text-slate-400">
                <PanelLeftClose size={14} aria-hidden="true" />
                Navigation
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="button-icon"
                aria-label="Close navigation"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <DashboardSidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <TourOverlay />
      <TourTrigger />
      <CommandPalette />
    </DashboardTourProvider>
  );
}
