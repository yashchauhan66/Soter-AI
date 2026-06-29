"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  Box,
  Building2,
  ChevronDown,
  CodeXml,
  CreditCard,
  Crosshair,
  Download,
  Eye,
  EyeOff,
  FileBarChart,
  FileSearch,
  Fingerprint,
  FolderKanban,
  Gauge,
  Handshake,
  KeyRound,
  Landmark,
  LifeBuoy,
  ListChecks,
  Milestone,
  Network,
  Radio,
  ScrollText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShieldClose,
  ShieldHalf,
  Siren,
  SlidersHorizontal,
  Swords,
  TrendingUp,
  VenetianMask,
  Wallet,
  Webhook,
  Wifi,
  DatabaseZap,
} from "lucide-react";

// ── Hero product definitions ────────────────────────────────────────────

interface HeroProduct {
  label: string;
  description: string;
  href: string;
  accent: string;
  gradient: string;
  border: string;
  iconBg: string;
  Icon: typeof Gauge;
  items: { Icon: typeof Gauge; label: string; href: string }[];
}

const heroProducts: HeroProduct[] = [
  {
    label: "AI Agent Control",
    description: "Approve, log, rollback agent actions",
    href: "/dashboard/agent-control",
    accent: "text-orange-300",
    gradient: "from-orange-500/10 via-amber-500/5 to-transparent",
    border: "border-orange-500/25",
    iconBg: "bg-orange-500/15",
    Icon: Gauge,
    items: [
      { Icon: ShieldAlert, label: "Agent firewall", href: "/dashboard/agent-firewall" },
      { Icon: VenetianMask, label: "Identity fabric", href: "/dashboard/identity-fabric" },
      { Icon: Crosshair, label: "Intent guard", href: "/dashboard/intent-guard" },
      { Icon: Swords, label: "Tool chain", href: "/dashboard/tool-chain" },
      { Icon: ShieldHalf, label: "Escrow", href: "/dashboard/escrow" },
      { Icon: Box, label: "Dry-run sandbox", href: "/dashboard/dry-run" },
      { Icon: Network, label: "Context lineage", href: "/dashboard/lineage" },
      { Icon: Radio, label: "Blast radius", href: "/dashboard/blast-radius" },
      { Icon: ShieldClose, label: "Memory firewall", href: "/dashboard/memory-firewall" },
      { Icon: Milestone, label: "MCP drift", href: "/dashboard/mcp-drift" },
      { Icon: Siren, label: "Legal boundary", href: "/dashboard/legal-boundary" },
      { Icon: VenetianMask, label: "Agent passports", href: "/dashboard/agent-passports" },
    ],
  },
  {
    label: "AI Usage Governance",
    description: "Policy, DLP, monitoring for employee AI use",
    href: "/dashboard/usage-governance",
    accent: "text-violet-300",
    gradient: "from-violet-500/10 via-blue-500/5 to-transparent",
    border: "border-violet-500/25",
    iconBg: "bg-violet-500/15",
    Icon: Landmark,
    items: [
      { Icon: SlidersHorizontal, label: "Policy config", href: "/dashboard/usage-governance/policy" },
      { Icon: ShieldAlert, label: "Provider rules", href: "/dashboard/usage-governance/providers" },
      { Icon: Building2, label: "Department rules", href: "/dashboard/usage-governance/departments" },
      { Icon: ListChecks, label: "Data classification", href: "/dashboard/usage-governance/data-classification" },
      { Icon: Eye, label: "Approval requests", href: "/dashboard/usage-governance/approvals" },
      { Icon: BarChart3, label: "Employee monitoring", href: "/dashboard/usage-governance/monitoring" },
      { Icon: ScrollText, label: "Audit trail", href: "/dashboard/usage-governance/audit" },
      { Icon: FileBarChart, label: "Compliance reports", href: "/dashboard/usage-governance/reports" },
    ],
  },
];

// ── Collapsed group definitions ─────────────────────────────────────────

interface NavGroup {
  label: string;
  items: { Icon: typeof Gauge; label: string; href: string; badge?: string }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Guard Operations",
    items: [
      { Icon: BarChart3, label: "Overview", href: "/dashboard" },
      { Icon: ScrollText, label: "Guard logs", href: "/dashboard/logs" },
      { Icon: FileBarChart, label: "Reports", href: "/dashboard/reports" },
      { Icon: TrendingUp, label: "Customer success", href: "/dashboard/customer-success" },
      { Icon: Eye, label: "Detection feedback", href: "/dashboard/detection-feedback" },
    ],
  },
  {
    label: "Security Tools",
    items: [
      { Icon: CodeXml, label: "AI Code Review", href: "/dashboard/code-security", badge: "NEW" },
      { Icon: DatabaseZap, label: "RAG security", href: "/dashboard/rag" },
      { Icon: FileSearch, label: "Model scanner", href: "/dashboard/security/model-scan", badge: "NEW" },
      { Icon: EyeOff, label: "Shadow AI", href: "/dashboard/shadow-ai" },
      { Icon: Swords, label: "Red team lab", href: "/dashboard/redteam/lab" },
      { Icon: Wallet, label: "Cost firewall", href: "/dashboard/cost-firewall" },
      { Icon: Fingerprint, label: "Credential vault", href: "/dashboard/credentials" },
      { Icon: Search, label: "Forensics", href: "/dashboard/forensics" },
      { Icon: Wifi, label: "Semantic egress", href: "/dashboard/semantic-egress" },
      { Icon: TrendingUp, label: "SLM evaluations", href: "/dashboard/evaluations" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { Icon: BookOpen, label: "Evidence vault", href: "/dashboard/evidence-vault" },
      { Icon: ShieldCheck, label: "Security badges", href: "/dashboard/badges" },
      { Icon: Download, label: "Audit exports", href: "/dashboard/exports" },
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
      { Icon: FolderKanban, label: "Projects", href: "/dashboard/projects" },
      { Icon: KeyRound, label: "API keys", href: "/dashboard/api-keys" },
      { Icon: SlidersHorizontal, label: "Policy engine", href: "/dashboard/policy" },
      { Icon: Webhook, label: "Webhooks", href: "/dashboard/webhooks" },
      { Icon: ListChecks, label: "Onboarding", href: "/dashboard/onboarding" },
      { Icon: LifeBuoy, label: "Support", href: "/dashboard/support" },
      { Icon: CreditCard, label: "Billing & usage", href: "/dashboard/billing" },
      { Icon: Settings, label: "Settings", href: "/dashboard/settings" },
    ],
  },
];

// ── Component ───────────────────────────────────────────────────────────

export function DashboardSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname?.startsWith(href);

  const [expandedHero, setExpandedHero] = useState<string | null>(() => {
    for (const p of heroProducts) {
      if (pathname?.startsWith(p.href) || p.items.some((i) => pathname?.startsWith(i.href))) {
        return p.label;
      }
    }
    return null;
  });

  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    for (const g of navGroups) {
      if (g.items.some((i) => isActive(i.href))) return g.label;
    }
    return null;
  });

  return (
    <aside className="card h-fit p-3">
      <div className="mb-3 px-3 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Workspace</p>
        <p className="mt-1 font-semibold">Security team</p>
      </div>

      <nav className="space-y-3">
        {/* ── Hero Products ── */}
        {heroProducts.map((product) => {
          const isExpanded = expandedHero === product.label;
          const isProductActive =
            isActive(product.href) || product.items.some((i) => isActive(i.href));

          return (
            <div
              key={product.label}
              className={`rounded-xl border bg-gradient-to-br p-1 ${product.border} ${product.gradient}`}
            >
              {/* Product header */}
              <button
                onClick={() => setExpandedHero(isExpanded ? null : product.label)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/5"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${product.iconBg}`}>
                  <product.Icon size={16} className={product.accent} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${isProductActive ? product.accent : "text-white"}`}>
                    {product.label}
                  </p>
                  <p className="text-[10px] text-slate-500">{product.description}</p>
                </div>
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {/* Product overview link */}
              <Link
                href={product.href}
                onClick={onClose}
                className={`mx-1 flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive(product.href) && !product.items.some((i) => isActive(i.href))
                    ? `${product.accent} bg-white/5`
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <product.Icon size={14} />
                <span>Overview</span>
              </Link>

              {/* Expandable sub-items */}
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <ul className="mx-1 space-y-0.5 pb-1">
                  {product.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs transition ${
                          isActive(item.href)
                            ? `${product.accent} bg-white/5`
                            : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                        }`}
                      >
                        <item.Icon size={13} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}

        {/* ── Collapsible Groups ── */}
        {navGroups.map((group) => {
          const isExpanded = expandedGroup === group.label;
          const isGroupActive = group.items.some((i) => isActive(i.href));

          return (
            <div key={group.label}>
              <button
                onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                className="flex w-full items-center justify-between px-3 py-2 text-left"
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                    isGroupActive ? "text-cyan" : "text-slate-600"
                  }`}
                >
                  {group.label}
                </p>
                <ChevronDown
                  size={12}
                  className={`text-slate-600 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isExpanded || isGroupActive ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const { Icon, label, href } = item;
                    const badge = item.badge ?? null;
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={onClose}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                            isActive(href)
                              ? "bg-cyan/10 text-cyan"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          <Icon size={16} />
                          <span className="flex-1">{label}</span>
                          {badge && (
                            <span className="rounded-full bg-cyan/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan">
                              {badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
