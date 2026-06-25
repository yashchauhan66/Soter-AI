"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { DashboardSidebar } from "./DashboardSidebar";
import { FeedbackWidget } from "@/components/ops/FeedbackWidget";
import { DashboardTourProvider } from "@/components/onboarding/DashboardTourProvider";
import { TourOverlay } from "@/components/onboarding/TourOverlay";
import { TourTrigger } from "@/components/onboarding/TourTrigger";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <DashboardTourProvider>
      <div className="container-page py-4 sm:py-8">
        {/* Mobile header with hamburger */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <p className="text-sm font-semibold text-slate-300">Security team</p>
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
            aria-label="Open sidebar menu"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="grid gap-7 lg:grid-cols-[240px_1fr]">
          {/* Mobile sidebar (slide-in) */}
          <aside
            className={`fixed left-0 top-0 z-50 h-full w-[280px] overflow-y-auto bg-ink shadow-xl transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:block lg:w-auto lg:translate-x-0 lg:shadow-none ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 p-4 lg:hidden">
              <p className="text-sm font-bold uppercase tracking-wider text-cyan">Menu</p>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
                aria-label="Close sidebar menu"
              >
                <X size={20} />
              </button>
            </div>
            <DashboardSidebar onClose={() => setSidebarOpen(false)} />
          </aside>

          {/* Main content */}
          <section className="min-w-0">{children}</section>
        </div>

        <FeedbackWidget />
      </div>
      <TourOverlay />
      <TourTrigger />
    </DashboardTourProvider>
  );
}
