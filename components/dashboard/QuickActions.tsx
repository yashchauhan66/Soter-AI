"use client";

import Link from "next/link";
import { Plus, KeyRound, Play, FileText, Shield, Compass } from "lucide-react";

/**
 * Quick actions row on the dashboard overview.
 *
 * The per-action `color` / `bg` pair was removed. Six actions carried six
 * different accent hues (cyan, yellow, emerald, purple, blue, slate) with
 * matching tinted icon chips, which meant this one card contained more colours
 * than the rest of the page combined — and the colours ranked nothing, since all
 * six actions are peers.
 *
 * Only "New project" keeps an accent, because it is the one action a new user
 * needs first.
 */
const actions = [
  {
    label: "New project",
    description: "Create a project and generate API keys",
    href: "/dashboard/projects/new",
    icon: Plus,
    primary: true,
  },
  {
    label: "Generate API key",
    description: "Issue a scoped server-side key",
    href: "/dashboard/api-keys",
    icon: KeyRound,
  },
  {
    label: "Test in playground",
    description: "Send test prompts to the guard",
    href: "/playground",
    icon: Play,
  },
  {
    label: "Integration wizard",
    description: "Copy-paste code for your stack",
    href: "/dashboard/integrations",
    icon: FileText,
  },
  {
    label: "Take the tour",
    description: "Explore all 40+ features",
    href: "/docs/quickstart",
    icon: Compass,
    isTour: true,
  },
  {
    label: "View docs",
    description: "Read integration documentation",
    href: "/docs",
    icon: Shield,
  },
];

export function QuickActions() {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-micro text-slate-500">Quick actions</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const content = (
            <div className="surface flex h-full items-start gap-3 p-3 transition-colors hover:border-slate-700 hover:bg-slate-800/50">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                  action.primary
                    ? "border-cyan/30 bg-cyan/10 text-cyan"
                    : "border-slate-700/60 bg-slate-900/60 text-slate-400"
                }`}
              >
                <Icon size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">{action.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-400">{action.description}</p>
              </div>
            </div>
          );

          if (action.isTour) {
            return (
              <button
                key={action.label}
                onClick={() => {
                  // Dispatch a custom event that the tour provider listens to
                  window.dispatchEvent(new CustomEvent("start-dashboard-tour"));
                }}
                className="text-left"
              >
                {content}
              </button>
            );
          }

          return (
            <Link key={action.href} href={action.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
