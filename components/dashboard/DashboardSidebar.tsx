"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CreditCard,
  Download,
  FileBarChart,
  FolderKanban,
  KeyRound,
  ListChecks,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Webhook,
  DatabaseZap,
  Handshake,
  LifeBuoy,
  TrendingUp,
} from "lucide-react";

const groups = [
  {
    label: "Operate",
    items: [
      { Icon: BarChart3, label: "Overview", href: "/dashboard" },
      { Icon: ScrollText, label: "Guard logs", href: "/dashboard/logs" },
      { Icon: FileBarChart, label: "Reports", href: "/dashboard/reports" },
      { Icon: TrendingUp, label: "Customer success", href: "/dashboard/customer-success" },
      { Icon: ShieldCheck, label: "Detection feedback", href: "/dashboard/detection-feedback" },
    ],
  },
  {
    label: "Configure",
    items: [
      { Icon: FolderKanban, label: "Projects", href: "/dashboard/projects" },
      { Icon: KeyRound, label: "API keys", href: "/dashboard/api-keys" },
      { Icon: SlidersHorizontal, label: "Policy", href: "/dashboard/policy" },
      { Icon: Webhook, label: "Webhooks", href: "/dashboard/webhooks" },
      { Icon: DatabaseZap, label: "RAG security", href: "/dashboard/rag" },
      { Icon: ShieldCheck, label: "Security badges", href: "/dashboard/badges" },
    ],
  },
  {
    label: "Agency",
    items: [
      { Icon: Handshake, label: "Partner program", href: "/dashboard/partner" },
      { Icon: Building2, label: "Agency overview", href: "/dashboard/agency" },
      { Icon: Building2, label: "Clients", href: "/dashboard/agency/clients" },
      { Icon: FileBarChart, label: "White-label report", href: "/dashboard/reports/white-label" },
      { Icon: Settings, label: "Branding", href: "/dashboard/agency/settings" },
    ],
  },
  {
    label: "Account",
    items: [
      { Icon: ListChecks, label: "Onboarding", href: "/dashboard/onboarding" },
      { Icon: LifeBuoy, label: "Support", href: "/dashboard/support" },
      { Icon: CreditCard, label: "Billing & usage", href: "/dashboard/billing" },
      { Icon: Download, label: "Audit exports", href: "/dashboard/exports" },
      { Icon: Settings, label: "Settings", href: "/dashboard/settings" },
    ],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname?.startsWith(href);

  return (
    <aside className="card h-fit p-3">
      <div className="mb-3 px-3 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Workspace</p>
        <p className="mt-1 font-semibold">Security team</p>
      </div>
      <nav className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ Icon, label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                      isActive(href) ? "bg-cyan/10 text-cyan" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
