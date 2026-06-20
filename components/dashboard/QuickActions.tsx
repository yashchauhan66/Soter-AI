"use client";

import Link from "next/link";
import { Plus, KeyRound, Play, FileText, Shield, Compass } from "lucide-react";

const actions = [
  {
    label: "New project",
    description: "Create a project and generate API keys",
    href: "/dashboard/projects/new",
    icon: Plus,
    color: "text-cyan",
    bg: "bg-cyan/10",
  },
  {
    label: "Generate API key",
    description: "Issue a scoped server-side key",
    href: "/dashboard/api-keys",
    icon: KeyRound,
    color: "text-yellow-300",
    bg: "bg-yellow-400/10",
  },
  {
    label: "Test in playground",
    description: "Send test prompts to the guard",
    href: "/playground",
    icon: Play,
    color: "text-emerald-300",
    bg: "bg-emerald-400/10",
  },
  {
    label: "Integration wizard",
    description: "Copy-paste code for your stack",
    href: "/dashboard/integrations",
    icon: FileText,
    color: "text-purple-300",
    bg: "bg-purple-400/10",
  },
  {
    label: "Take the tour",
    description: "Explore all 40+ features",
    href: "#",
    icon: Compass,
    color: "text-blue-300",
    bg: "bg-blue-400/10",
    isTour: true,
  },
  {
    label: "View docs",
    description: "Read integration documentation",
    href: "/docs",
    icon: Shield,
    color: "text-slate-300",
    bg: "bg-slate-800/50",
  },
];

export function QuickActions() {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Quick actions
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const content = (
            <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3 transition hover:border-slate-700 hover:bg-slate-900/50">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.bg}`}>
                <Icon size={18} className={action.color} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{action.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{action.description}</p>
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
