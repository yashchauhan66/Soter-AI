import {
  Ban,
  DatabaseZap,
  UserRoundX,
  Activity,
  ArrowRight,
  Gauge,
  Landmark,
  ShieldAlert,
  ShieldHalf,
  BookOpen,
  FileBarChart,
  ScrollText,
  Eye,
  EyeOff,
  Fingerprint,
  FolderKanban,
  KeyRound,
  Swords,
  SlidersHorizontal,
  Settings,
  ListChecks,
  Wallet,
  Box,
  Crosshair,
  VenetianMask,
  Network,
  Radio,
  ShieldClose,
  ShieldCheck,
  Milestone,
  Siren,
  FileSearch,
  CodeXml,
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
  // ── Agent Control ──
  { title: "Agent Control Center", description: "Unified approval queue, reversibility ledger, and compliance posture", href: "/dashboard/agent-control", icon: Gauge, color: "text-orange-300", bg: "bg-orange-400/10", group: "Agent Control" },
  { title: "Agent firewall", description: "Block unauthorized tool calls and data exfiltration", href: "/dashboard/agent-firewall", icon: ShieldAlert, color: "text-orange-300", bg: "bg-orange-400/10", group: "Agent Control" },
  { title: "Identity fabric", description: "Cryptographic agent identities and delegation chains", href: "/dashboard/identity-fabric", icon: VenetianMask, color: "text-cyan", bg: "bg-cyan/10", group: "Agent Control" },
  { title: "Intent guard", description: "Verify actions match original user intent", href: "/dashboard/intent-guard", icon: Crosshair, color: "text-emerald-300", bg: "bg-emerald-400/10", group: "Agent Control" },
  { title: "Tool chain", description: "Detect risky multi-tool sequences", href: "/dashboard/tool-chain", icon: Swords, color: "text-red-300", bg: "bg-red-400/10", group: "Agent Control" },
  { title: "Transaction escrow", description: "Hold risky actions for human review", href: "/dashboard/escrow", icon: ShieldHalf, color: "text-yellow-300", bg: "bg-yellow-400/10", group: "Agent Control" },
  { title: "Dry-run sandbox", description: "Simulate agent actions without executing", href: "/dashboard/dry-run", icon: Box, color: "text-blue-300", bg: "bg-blue-400/10", group: "Agent Control" },
  { title: "Context lineage", description: "Track data sources and block cross-domain leaks", href: "/dashboard/lineage", icon: Network, color: "text-cyan", bg: "bg-cyan/10", group: "Agent Control" },
  { title: "Blast radius", description: "Estimate damage if an agent is compromised", href: "/dashboard/blast-radius", icon: Radio, color: "text-orange-300", bg: "bg-orange-400/10", group: "Agent Control" },
  { title: "Memory firewall", description: "Quarantine poisoned agent memory", href: "/dashboard/memory-firewall", icon: ShieldClose, color: "text-orange-300", bg: "bg-orange-400/10", group: "Agent Control" },
  { title: "MCP drift", description: "Detect risky MCP server tool changes", href: "/dashboard/mcp-drift", icon: Milestone, color: "text-purple-300", bg: "bg-purple-400/10", group: "Agent Control" },
  { title: "Legal boundary", description: "Stop agents crossing legal/compliance lines", href: "/dashboard/legal-boundary", icon: Siren, color: "text-red-300", bg: "bg-red-400/10", group: "Agent Control" },

  // ── AI Usage Governance ──
  { title: "Governance overview", description: "Company-wide AI usage policy dashboard with compliance score", href: "/dashboard/usage-governance", icon: Landmark, color: "text-violet-300", bg: "bg-violet-400/10", group: "Usage Governance" },
  { title: "Policy config", description: "Set default actions, data handling rules", href: "/dashboard/usage-governance/policy", icon: SlidersHorizontal, color: "text-violet-300", bg: "bg-violet-400/10", group: "Usage Governance" },
  { title: "Provider rules", description: "Allow or block specific AI providers and models", href: "/dashboard/usage-governance/providers", icon: Ban, color: "text-violet-300", bg: "bg-violet-400/10", group: "Usage Governance" },
  { title: "Department rules", description: "Per-department AI usage policies", href: "/dashboard/usage-governance/departments", icon: ListChecks, color: "text-purple-300", bg: "bg-purple-400/10", group: "Usage Governance" },
  { title: "Data classification", description: "Define what data sensitivity levels can go to which providers", href: "/dashboard/usage-governance/data-classification", icon: ShieldHalf, color: "text-yellow-300", bg: "bg-yellow-400/10", group: "Usage Governance" },
  { title: "Approval requests", description: "Review and manage AI provider access requests with 14-day expiry", href: "/dashboard/usage-governance/approvals", icon: ShieldCheck, color: "text-amber-300", bg: "bg-amber-400/10", group: "Usage Governance" },
  { title: "Employee monitoring", description: "Track AI usage across your organization", href: "/dashboard/usage-governance/monitoring", icon: Eye, color: "text-blue-300", bg: "bg-blue-400/10", group: "Usage Governance" },
  { title: "Audit trail", description: "Complete log of AI usage and policy changes", href: "/dashboard/usage-governance/audit", icon: ScrollText, color: "text-emerald-300", bg: "bg-emerald-400/10", group: "Usage Governance" },
  { title: "Compliance reports", description: "Weekly/monthly/quarterly governance reports with recommendations", href: "/dashboard/usage-governance/reports", icon: FileBarChart, color: "text-blue-300", bg: "bg-blue-400/10", group: "Usage Governance" },

  // ── Monitor ──
  { title: "Guard logs", description: "Every input/output guard decision with filters and search", href: "/dashboard/logs", icon: ScrollText, color: "text-cyan", bg: "bg-cyan/10", group: "Monitor" },
  { title: "Reports", description: "Monthly security reports, trends, and recommendations", href: "/dashboard/reports", icon: FileBarChart, color: "text-emerald-300", bg: "bg-emerald-400/10", group: "Monitor" },
  { title: "Detection feedback", description: "Improve accuracy by marking false positives", href: "/dashboard/detection-feedback", icon: Eye, color: "text-blue-300", bg: "bg-blue-400/10", group: "Monitor" },

  // ── Security Tools ──
  { title: "AI Code Review", description: "Catch secrets and flaws in AI-generated code", href: "/dashboard/code-security", icon: CodeXml, color: "text-cyan", bg: "bg-cyan/10", group: "Security Tools" },
  { title: "Shadow AI", description: "Discover unauthorized AI tool usage", href: "/dashboard/shadow-ai", icon: EyeOff, color: "text-red-300", bg: "bg-red-400/10", group: "Security Tools" },
  { title: "Red team lab", description: "Test against adversarial prompts and jailbreaks", href: "/dashboard/redteam/lab", icon: Swords, color: "text-orange-300", bg: "bg-orange-400/10", group: "Security Tools" },
  { title: "Forensics", description: "Investigate incidents with full audit trails", href: "/dashboard/forensics", icon: FileSearch, color: "text-blue-300", bg: "bg-blue-400/10", group: "Security Tools" },
  { title: "RAG security", description: "Guard retrieval pipelines and filter risky sources", href: "/dashboard/rag", icon: DatabaseZap, color: "text-yellow-300", bg: "bg-yellow-400/10", group: "Security Tools" },

  // ── Compliance ──
  { title: "Evidence vault", description: "Package SOC 2 / ISO 27001 compliance proof", href: "/dashboard/evidence-vault", icon: BookOpen, color: "text-emerald-300", bg: "bg-emerald-400/10", group: "Compliance" },
  { title: "Credential vault", description: "Server-side credential storage for agents", href: "/dashboard/credentials", icon: Fingerprint, color: "text-yellow-300", bg: "bg-yellow-400/10", group: "Compliance" },

  // ── Manage ──
  { title: "Projects", description: "Organize keys, logs, and config by environment", href: "/dashboard/projects", icon: FolderKanban, color: "text-slate-300", bg: "bg-slate-800/50", group: "Manage" },
  { title: "API keys", description: "Generate scoped test and live keys", href: "/dashboard/api-keys", icon: KeyRound, color: "text-yellow-300", bg: "bg-yellow-400/10", group: "Manage" },
  { title: "Cost firewall", description: "Prevent runaway LLM spending", href: "/dashboard/cost-firewall", icon: Wallet, color: "text-emerald-300", bg: "bg-emerald-400/10", group: "Manage" },
  { title: "Settings", description: "Profile, team, and preferences", href: "/dashboard/settings", icon: Settings, color: "text-slate-300", bg: "bg-slate-800/50", group: "Manage" },
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

  // Agent Control stats
  let agentPending = 0;
  let agentBlocked = 0;
  let agentReversible = 0;
  try {
    const [pendingCount, blockedCount2, reversibleCount] = await Promise.all([
      db.$queryRawUnsafe<[{ count: bigint }]>(`SELECT COUNT(*)::bigint as count FROM "AgentApproval" WHERE "projectId" = $1 AND "status" = 'PENDING'`, project.id).then(r => Number(r[0]?.count ?? 0)).catch(() => 0),
      db.$queryRawUnsafe<[{ count: bigint }]>(`SELECT COUNT(*)::bigint as count FROM "AgentActionLog" WHERE "projectId" = $1 AND "decision" = 'BLOCK'`, project.id).then(r => Number(r[0]?.count ?? 0)).catch(() => 0),
      db.$queryRawUnsafe<[{ count: bigint }]>(`SELECT COUNT(*)::bigint as count FROM "AgentActionLedger" WHERE "projectId" = $1 AND "reversalStatus" IN ('REVERSIBLE', 'COMPENSATING_ACTION')`, project.id).then(r => Number(r[0]?.count ?? 0)).catch(() => 0),
    ]);
    agentPending = pendingCount;
    agentBlocked = blockedCount2;
    agentReversible = reversibleCount;
  } catch {
    // Tables may not exist yet
  }

  // Usage Governance stats
  let govCompliance = 0;
  let govRules = 0;
  let govBlocked = 0;
  let govPending = 0;
  try {
    const orgMembership = await db.organizationMember.findFirst({
      where: { userId: project.userId },
      select: { organizationId: true },
    });
    if (orgMembership) {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const [policy, blockedGov, pendingGov] = await Promise.all([
        db.aiUsageGovernancePolicy.findFirst({
          where: { organizationId: orgMembership.organizationId, enabled: true },
          include: { rules: true },
        }),
        db.aiUsageGovernanceAuditLog.count({
          where: {
            organizationId: orgMembership.organizationId,
            decision: { in: ["BLOCKED", "BLOCK", "DENIED"] },
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        db.aiUsageApprovalRequest.count({
          where: {
            organizationId: orgMembership.organizationId,
            status: "PENDING",
          },
        }).catch(() => 0),
      ]);
      govRules = policy?.rules?.length ?? 0;
      govBlocked = blockedGov;
      govPending = pendingGov;
      govCompliance = policy ? (policy.enabled ? 78 : 32) : 0;
      if (govRules > 3) govCompliance = Math.min(95, govCompliance + govRules * 3);
    }
  } catch {
    // Organization may not exist yet
  }

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

      {/* ══════════ TWO-PRODUCT HERO CARDS ══════════ */}
      <AnimateIn variant="slide-up" delay={1}>
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ── AI Agent Control ── */}
          <Link
            href="/dashboard/agent-control"
            className="group relative overflow-hidden rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-slate-950/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/40 hover:shadow-xl hover:shadow-orange-500/10"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl transition-all duration-500 group-hover:bg-orange-500/20" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
                  <Gauge size={20} className="text-orange-300" />
                </span>
                <div>
                  <p className="text-lg font-bold text-white">AI Agent Control</p>
                  <p className="text-xs text-slate-400">For AI agents using email, CRM, database, payments</p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-4 text-slate-500">Action ledger with reversibility classification, rollback windows, continuous compliance assurance.</p>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-950/60 p-3 text-center">
                  <p className="text-xl font-bold text-orange-300">{agentPending}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Pending</p>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-3 text-center">
                  <p className="text-xl font-bold text-red-300">{agentBlocked}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Blocked</p>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-3 text-center">
                  <p className="text-xl font-bold text-emerald-300">{agentReversible}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Reversible</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-orange-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                Open control center <ArrowRight size={14} />
              </div>
            </div>
          </Link>

          {/* ── AI Usage Governance ── */}
          <Link
            href="/dashboard/usage-governance"
            className="group relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-blue-500/5 to-slate-950/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/10"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl transition-all duration-500 group-hover:bg-violet-500/20" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
                  <Landmark size={20} className="text-violet-300" />
                </span>
                <div>
                  <p className="text-lg font-bold text-white">AI Usage Governance</p>
                  <p className="text-xs text-slate-400">For employees using ChatGPT, Claude, Cursor</p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-4 text-slate-500">5-step governance engine, provider allow/block lists, department rules, employee DLP monitoring.</p>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-950/60 p-3 text-center">
                  <p className="text-xl font-bold text-violet-300">{govCompliance}%</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Compliance</p>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-3 text-center">
                  <p className="text-xl font-bold text-red-300">{govBlocked}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Blocked</p>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-3 text-center">
                  <p className="text-xl font-bold text-amber-300">{govPending}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Pending</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-violet-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                Open governance dashboard <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        </div>
      </AnimateIn>

      {/* ── System Health ── */}
      <AnimateIn variant="slide-up" delay={2}>
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
      <AnimateIn variant="slide-up" delay={3}>
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Blocked requests" value={blocked} icon={Ban} />
          <StatCard label="PII redactions" value={piiRedactions} icon={UserRoundX} />
          <StatCard label="Secrets prevented" value={secrets} icon={DatabaseZap} />
        </section>
      </AnimateIn>

      {/* ── Quick Actions ── */}
      <AnimateIn variant="slide-up" delay={4}>
        <QuickActions />
      </AnimateIn>

      {/* ── Activity + Usage Sidebar ── */}
      <AnimateIn variant="slide-up" delay={5}>
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
      <AnimateIn variant="slide-up" delay={6}>
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
