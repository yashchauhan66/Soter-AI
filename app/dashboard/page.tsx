import {
  Ban,
  DatabaseZap,
  ShieldCheck,
  UserRoundX,
  Activity,
  ShieldAlert,
  BookOpen,
  Box,
  Crosshair,
  Eye,
  EyeOff,
  FileBarChart,
  FileSearch,
  Fingerprint,
  FolderKanban,
  KeyRound,
  Milestone,
  Network,
  Radio,
  ScrollText,
  ShieldClose,
  ShieldHalf,
  Siren,
  SlidersHorizontal,
  Swords,
  VenetianMask,
  Wallet,
  Webhook,
  Wifi,
  Settings,
  ListChecks,
  CreditCard,
  Download,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { LogsTable } from "@/components/dashboard/LogsTable";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { RiskChart } from "@/components/dashboard/RiskChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { UsageCard } from "@/components/dashboard/UsageCard";
import { FeatureSearchBar } from "@/components/dashboard/FeatureSearchBar";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { AnimateIn } from "@/components/ui/AnimateIn";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { getTopRiskTypes } from "@/lib/dashboard/metrics";
import { db } from "@/lib/db";
import { guardLogListSelect } from "@/lib/guard/logSelect";
import { checkMonthlyLimit } from "@/lib/rateLimit";
import { recordRequestMetric } from "@/lib/ops/monitoring";

export const dynamic = "force-dynamic";

async function recordDashboardLatency(startedAt: Date) {
  void recordRequestMetric("dashboard_latency_ms", Date.now() - startedAt.getTime());
}

// ── Feature discovery cards ──────────────────────────────────────────────

interface FeatureCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  group: string;
}

const FEATURE_CARDS: FeatureCard[] = [
  // ── Monitor ──
  { title: "Guard logs", description: "Every input/output guard decision with filters and search", href: "/dashboard/logs", icon: ScrollText, color: "text-cyan", bg: "bg-cyan/10", group: "Monitor" },
  { title: "Reports", description: "Monthly security reports, trends, and recommendations", href: "/dashboard/reports", icon: FileBarChart, color: "text-emerald-300", bg: "bg-emerald-400/10", group: "Monitor" },
  { title: "Detection feedback", description: "Improve accuracy by marking false positives", href: "/dashboard/detection-feedback", icon: Eye, color: "text-blue-300", bg: "bg-blue-400/10", group: "Monitor" },
  { title: "Customer success", description: "Activation rates, usage funnel, and churn risk", href: "/dashboard/customer-success", icon: TrendingUp, color: "text-purple-300", bg: "bg-purple-400/10", group: "Monitor" },

  // ── Protect ──
  { title: "Agent firewall", description: "Block unauthorized tool calls and data exfiltration", href: "/dashboard/agent-firewall", icon: ShieldAlert, color: "text-orange-300", bg: "bg-orange-400/10", group: "Protect" },
  { title: "Policy engine", description: "Set risk thresholds and action defaults", href: "/dashboard/policy", icon: SlidersHorizontal, color: "text-cyan", bg: "bg-cyan/10", group: "Protect" },
  { title: "RAG security", description: "Guard retrieval pipelines and filter risky sources", href: "/dashboard/rag", icon: BookOpen, color: "text-yellow-300", bg: "bg-yellow-400/10", group: "Protect" },
  { title: "Webhooks", description: "Real-time signed events for attacks and alerts", href: "/dashboard/webhooks", icon: Webhook, color: "text-indigo-300", bg: "bg-indigo-400/10", group: "Protect" },

  // ── Detect ──
  { title: "Shadow AI", description: "Discover unauthorized AI tool usage", href: "/dashboard/shadow-ai", icon: EyeOff, color: "text-red-300", bg: "bg-red-400/10", group: "Detect" },
  { title: "Red team lab", description: "Test against adversarial prompts and jailbreaks", href: "/dashboard/redteam/lab", icon: Swords, color: "text-orange-300", bg: "bg-orange-400/10", group: "Detect" },
  { title: "Forensics", description: "Investigate incidents with full audit trails", href: "/dashboard/forensics", icon: FileSearch, color: "text-blue-300", bg: "bg-blue-400/10", group: "Detect" },
  { title: "Semantic egress", description: "Catch paraphrased confidential data leaving", href: "/dashboard/semantic-egress", icon: Wifi, color: "text-pink-300", bg: "bg-pink-400/10", group: "Detect" },

  // ── Control ──
  { title: "Agent passports", description: "Cryptographically signed agent identities", href: "/dashboard/agent-passports", icon: VenetianMask, color: "text-cyan", bg: "bg-cyan/10", group: "Control" },
  { title: "Transaction escrow", description: "Hold risky actions for human review", href: "/dashboard/escrow", icon: ShieldHalf, color: "text-yellow-300", bg: "bg-yellow-400/10", group: "Control" },
  { title: "Intent guard", description: "Verify actions match original user intent", href: "/dashboard/intent-guard", icon: Crosshair, color: "text-emerald-300", bg: "bg-emerald-400/10", group: "Control" },
  { title: "Tool chain", description: "Detect risky multi-tool sequences", href: "/dashboard/tool-chain", icon: Swords, color: "text-red-300", bg: "bg-red-400/10", group: "Control" },
  { title: "Dry-run sandbox", description: "Simulate agent actions without executing", href: "/dashboard/dry-run", icon: Box, color: "text-blue-300", bg: "bg-blue-400/10", group: "Control" },
  { title: "Memory firewall", description: "Quarantine poisoned agent memory", href: "/dashboard/memory-firewall", icon: ShieldClose, color: "text-orange-300", bg: "bg-orange-400/10", group: "Control" },
  { title: "MCP drift", description: "Detect risky MCP server tool changes", href: "/dashboard/mcp-drift", icon: Milestone, color: "text-purple-300", bg: "bg-purple-400/10", group: "Control" },
  { title: "Legal boundary", description: "Stop agents crossing legal/compliance lines", href: "/dashboard/legal-boundary", icon: Siren, color: "text-red-300", bg: "bg-red-400/10", group: "Control" },

  // ── Compliance ──
  { title: "Evidence vault", description: "Package SOC 2 / ISO 27001 compliance proof", href: "/dashboard/evidence-vault", icon: BookOpen, color: "text-emerald-300", bg: "bg-emerald-400/10", group: "Compliance" },
  { title: "Context lineage", description: "Track data sources and block cross-domain leaks", href: "/dashboard/lineage", icon: Network, color: "text-cyan", bg: "bg-cyan/10", group: "Compliance" },
  { title: "Blast radius", description: "Estimate damage if an agent is compromised", href: "/dashboard/blast-radius", icon: Radio, color: "text-orange-300", bg: "bg-orange-400/10", group: "Compliance" },
  { title: "Credential vault", description: "Server-side credential storage for agents", href: "/dashboard/credentials", icon: Fingerprint, color: "text-yellow-300", bg: "bg-yellow-400/10", group: "Compliance" },

  // ── Manage ──
  { title: "Projects", description: "Organize keys, logs, and config by environment", href: "/dashboard/projects", icon: FolderKanban, color: "text-slate-300", bg: "bg-slate-800/50", group: "Manage" },
  { title: "API keys", description: "Generate scoped test and live keys", href: "/dashboard/api-keys", icon: KeyRound, color: "text-yellow-300", bg: "bg-yellow-400/10", group: "Manage" },
  { title: "Cost firewall", description: "Prevent runaway LLM spending", href: "/dashboard/cost-firewall", icon: Wallet, color: "text-emerald-300", bg: "bg-emerald-400/10", group: "Manage" },
  { title: "Security badges", description: "Show protected status on your site", href: "/dashboard/badges", icon: ShieldCheck, color: "text-cyan", bg: "bg-cyan/10", group: "Manage" },
  { title: "Billing", description: "Plan, usage, and upgrade options", href: "/dashboard/billing", icon: CreditCard, color: "text-blue-300", bg: "bg-blue-400/10", group: "Manage" },
  { title: "Settings", description: "Profile, team, and preferences", href: "/dashboard/settings", icon: Settings, color: "text-slate-300", bg: "bg-slate-800/50", group: "Manage" },
  { title: "Audit exports", description: "Download audit logs for compliance", href: "/dashboard/exports", icon: Download, color: "text-purple-300", bg: "bg-purple-400/10", group: "Manage" },
  { title: "Onboarding", description: "Complete the guided setup checklist", href: "/dashboard/onboarding", icon: ListChecks, color: "text-cyan", bg: "bg-cyan/10", group: "Manage" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const startedAt = new Date();
  const params = await searchParams;
  const [project, projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const usage = await checkMonthlyLimit(project.id, project.plan);
  const [logs, riskData, aggregate, total, blocked, piiRedactions, secrets] = await Promise.all([
    db.guardLog.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" }, take: 8, select: guardLogListSelect }),
    getTopRiskTypes(project.id, monthStart),
    db.guardLog.aggregate({ where: { projectId: project.id }, _avg: { riskScore: true } }),
    db.guardLog.count({ where: { projectId: project.id } }),
    db.guardLog.count({ where: { projectId: project.id, action: "BLOCK" } }),
    db.guardLog.count({
      where: {
        projectId: project.id,
        action: "ALLOW_WITH_REDACTION",
        OR: [
          { riskTypes: { has: "PII_DETECTED" } },
          { riskTypes: { has: "INDIA_PII_DETECTED" } },
        ],
      },
    }),
    db.guardLog.count({ where: { projectId: project.id, riskTypes: { has: "SECRET_DETECTED" } } }),
  ]);

  void recordDashboardLatency(startedAt);

  const avgRisk = Math.round(aggregate._avg.riskScore ?? 0);
  const topRisk = riskData[0]?.label.replaceAll("_", " ") ?? "LOW RISK";
  const groups = [...new Set(FEATURE_CARDS.map((c) => c.group))];

  return (
    <div className="space-y-8">
      {/* ── Header + Search ── */}
      <AnimateIn variant="slide-down">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Security overview</p>
              <h1 className="mt-2 text-3xl font-bold">Guard operations</h1>
            </div>
            <div className="flex items-center gap-3">
              <ProjectSwitcher projects={projects} selectedId={project.id} />
            </div>
          </div>

          {/* Search bar */}
          <div className="max-w-xl">
            <FeatureSearchBar />
          </div>
        </div>
      </AnimateIn>

      {/* ── Usage Banner ── */}
      {usage.exceeded && (
        <AnimateIn variant="fade-in" delay={1}>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
            Monthly request limit exceeded for plan <strong>{project.plan}</strong>. Guarded API calls are now blocked
            with HTTP 429. <Link className="underline" href="/dashboard/billing">Upgrade or review usage →</Link>
          </div>
        </AnimateIn>
      )}
      {!usage.exceeded && usage.warning && (
        <AnimateIn variant="fade-in" delay={1}>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            You have used over 80% of the {project.plan} monthly quota.
            <Link className="ml-1 underline" href="/dashboard/billing">Plan & usage →</Link>
          </div>
        </AnimateIn>
      )}

      {/* ── System Health ── */}
      <AnimateIn variant="slide-up" delay={1}>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card p-5 transition hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Plan</p>
                <p className="mt-1 text-2xl font-bold">{project.plan}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                usage.exceeded ? "bg-red-400/10 text-red-300" :
                usage.warning ? "bg-amber-400/10 text-amber-300" :
                "bg-emerald-400/10 text-emerald-300"
              }`}>
                {usage.exceeded ? "Exceeded" : usage.warning ? "Warning" : "Healthy"}
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-400">Monthly usage</span>
                <span className="text-slate-300">{usage.used.toLocaleString("en-IN")} / {usage.limit.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    usage.exceeded ? "bg-red-400" : usage.warning ? "bg-amber-400" : "bg-cyan"
                  }`}
                  style={{ width: `${Math.min(100, Math.round(usage.ratio * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <MetricCard label="Total requests" value={total} tone="gray" />
          <MetricCard label="Avg risk score" value={avgRisk} tone={avgRisk > 60 ? "red" : avgRisk > 30 ? "yellow" : "cyan"} />
          <MetricCard label="Top risk" value={topRisk} tone={topRisk.includes("CRITICAL") ? "red" : "yellow"} />
        </section>
      </AnimateIn>

      {/* ── Guard Stats ── */}
      <AnimateIn variant="slide-up" delay={2}>
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Blocked requests" value={blocked} icon={Ban} />
          <StatCard label="PII redactions" value={piiRedactions} icon={UserRoundX} />
          <StatCard label="Secrets prevented" value={secrets} icon={DatabaseZap} />
        </section>
      </AnimateIn>

      {/* ── Quick Actions ── */}
      <AnimateIn variant="slide-up" delay={3}>
        <QuickActions />
      </AnimateIn>

      {/* ── Activity + Usage Sidebar ── */}
      <AnimateIn variant="slide-up" delay={4}>
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Activity size={18} className="text-cyan" />
              Recent guard activity
            </h2>
            <LogsTable logs={logs} />
          </div>
          <div className="space-y-6">
            <UsageCard plan={project.plan} used={usage.used} limit={usage.limit} warning={usage.warning} exceeded={usage.exceeded} />
            <RiskChart data={riskData} />
          </div>
        </div>
      </AnimateIn>

      {/* ── Feature Discovery ── */}
      <AnimateIn variant="slide-up" delay={5}>
        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">All features</h2>
              <p className="mt-1 text-sm text-slate-500">
                {FEATURE_CARDS.length} features across {groups.length} areas
              </p>
            </div>
            <Link href="/onboarding" className="text-sm text-cyan hover:underline">
              Guided setup →
            </Link>
          </div>

          {groups.map((group) => (
            <div key={group} className="mb-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                {group}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURE_CARDS.filter((c) => c.group === group).map((card) => {
                  const Icon = card.icon;
                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="group card relative overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5"
                    >
                      {/* Hover accent bar */}
                      <div className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-cyan to-blue-400 transition-transform duration-300 group-hover:scale-x-100" />
                      <div className="flex items-start gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${card.bg} ${card.color}`}>
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white transition-colors duration-200 group-hover:text-cyan">
                            {card.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {card.description}
                          </p>
                        </div>
                      </div>
                      <div className="absolute right-4 top-4 text-slate-700 transition-all duration-200 group-hover:text-cyan group-hover:translate-x-0.5">
                        →
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </AnimateIn>
    </div>
  );
}
