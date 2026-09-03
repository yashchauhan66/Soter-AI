"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/Dialog";
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
 * - **The mobile drawer is a Radix sheet.** It was ~40 lines of hand-rolled
 *   dialog: an Escape listener, a `querySelectorAll` Tab trap, and manual
 *   `body.style.overflow` juggling. All three now come from
 *   `components/ui/Dialog.tsx`, which also gives the drawer correct focus
 *   *restore* — the previous version never returned focus to the trigger after
 *   closing, so a keyboard user landed back at the top of the document. The trap
 *   also missed `<input>`/`<select>`, which matters here because the sidebar
 *   contains a search field.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <DashboardTourProvider>
      <div className="container-page py-4 sm:py-8">
        {/* Mobile navigation trigger + drawer */}
        <Dialog open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <div className="mb-4 lg:hidden">
            <DialogTrigger className="surface flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:border-slate-700">
              <Menu size={17} aria-hidden="true" className="shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-micro text-slate-500">
                  SoterAI console
                </span>
                <span className="block text-sm font-semibold text-slate-100">Browse all sections</span>
              </span>
            </DialogTrigger>
          </div>

          <SheetContent title="Navigation">
            {/* Closing on navigation stays explicit: Radix cannot know that a link
                click inside the sheet changed the route. */}
            <DashboardSidebar onClose={() => setSidebarOpen(false)} />
          </SheetContent>
        </Dialog>

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

      <TourOverlay />
      <TourTrigger />
      <CommandPalette />
    </DashboardTourProvider>
  );
}
