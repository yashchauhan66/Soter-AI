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
import { FirstRunGuide } from "@/components/dashboard/FirstRunGuide";
import { UserSuccessCommandCenter } from "@/components/dashboard/UserSuccessCommandCenter";
import { AnimateIn } from "@/components/ui/AnimateIn";
import { CompositionBar } from "@/components/ui/Chart";
import { SITE_URL } from "@/lib/seo/schema";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { loadOnboarding } from "@/lib/onboarding";
import { nextOnboardingAction } from "@/lib/ux/activationPaths";
import { getTopRiskTypes } from "@/lib/dashboard/metrics";
import { db } from "@/lib/db";
import { guardLogListSelect } from "@/lib/guard/logSelect";
import { checkMonthlyLimit } from "@/lib/rateLimit";
import { recordRequestMetric } from "@/lib/ops/monitoring";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

async function recordDashboardLatency(startedAt: Date) {
  void recordRequestMetric("dashboard_latency_ms", Date.now() - startedAt.getTime());
}

// ── Feature discovery cards ──────────────────────────────────────────────

/**
 * One tile in the "All features" directory.
 *
 * `tone` replaces the previous `color` + `bg` pair. Two reasons:
 *
 * 1. **The palette was the problem.** These 35 tiles used eleven different
 *    accent hues — orange, cyan, emerald, red, yellow, blue, violet, purple,
 *    amber, and two greys — each with a matching tinted background. Eleven
 *    accents is not a palette, it is an absence of one, and it is the single
 *    thing that made this page read as unprofessional: colour carried no
 *    meaning, so the eye had nothing to prioritise. The set below is four
 *    tones, and each one means something.
 * 2. The `bg` field was rendered into a tinted chip behind every icon. Those
 *    chips are now one neutral container, so the icon glyph is the only thing
 *    carrying tone.
 */
interface FeatureCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /**
   * Semantic accent for the icon glyph only.
   *
   * - `brand`   — the flagship surface of its group (one per group at most)
   * - `caution` — anything that gates, holds, or queues work for a human
   * - `danger`  — anything whose job is to block or contain an active threat
   * - `neutral` — everything else, which is most of them
   */
  tone: "brand" | "caution" | "danger" | "neutral";
  group: string;
}

const TONE_CLASS: Record<FeatureCard["tone"], string> = {
  brand: "text-cyan",
  caution: "text-amber-300",
  danger: "text-rose-300",
  neutral: "text-slate-400",
};

/**
 * One figure inside a product hero card.
 *
 * Extracted because the same block appeared six times with a different hardcoded
 * colour each time, and the tone had no relationship to what the number meant —
 * "Pending" was orange on one card and amber on the other for the same concept.
 *
 * Tone here is semantic: `caution` for work queued on a human, `danger` for
 * blocks, `good` for a healthy signal, `neutral` for zero/no-signal.
 */
const HERO_STAT_TONE = {
  good: "text-emerald-300",
  caution: "text-amber-300",
  danger: "text-rose-300",
  neutral: "text-slate-300",
} as const;

function HeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: keyof typeof HERO_STAT_TONE;
}) {
  return (
    <div className="surface px-3 py-2.5 text-center">
      <p data-numeric className={`text-xl font-semibold ${HERO_STAT_TONE[tone]}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-micro text-slate-500">{label}</p>
    </div>
  );
}

const FEATURE_CARDS: FeatureCard[] = [
  // ── Agent Control ──
  { title: "Agent Control Center", description: "Unified approval queue, reversibility ledger, and compliance posture", href: "/dashboard/agent-control", icon: Gauge, tone: "brand", group: "Agent Control" },
  { title: "Agent firewall", description: "Block unauthorized tool calls and data exfiltration", href: "/dashboard/agent-firewall", icon: ShieldAlert, tone: "danger", group: "Agent Control" },
  { title: "Identity fabric", description: "Cryptographic agent identities and delegation chains", href: "/dashboard/identity-fabric", icon: VenetianMask, tone: "neutral", group: "Agent Control" },
  { title: "Intent guard", description: "Verify actions match original user intent", href: "/dashboard/intent-guard", icon: Crosshair, tone: "neutral", group: "Agent Control" },
  { title: "Tool chain", description: "Detect risky multi-tool sequences", href: "/dashboard/tool-chain", icon: Swords, tone: "danger", group: "Agent Control" },
  { title: "Transaction escrow", description: "Hold risky actions for human review", href: "/dashboard/escrow", icon: ShieldHalf, tone: "caution", group: "Agent Control" },
  { title: "Dry-run sandbox", description: "Simulate agent actions without executing", href: "/dashboard/dry-run", icon: Box, tone: "neutral", group: "Agent Control" },
  { title: "Context lineage", description: "Track data sources and block cross-domain leaks", href: "/dashboard/lineage", icon: Network, tone: "neutral", group: "Agent Control" },
  { title: "Blast radius", description: "Estimate damage if an agent is compromised", href: "/dashboard/blast-radius", icon: Radio, tone: "neutral", group: "Agent Control" },
  { title: "Memory firewall", description: "Quarantine poisoned agent memory", href: "/dashboard/memory-firewall", icon: ShieldClose, tone: "danger", group: "Agent Control" },
  { title: "MCP drift", description: "Detect risky MCP server tool changes", href: "/dashboard/mcp-drift", icon: Milestone, tone: "neutral", group: "Agent Control" },
  { title: "Legal boundary", description: "Stop agents crossing legal/compliance lines", href: "/dashboard/legal-boundary", icon: Siren, tone: "danger", group: "Agent Control" },

  // ── AI Usage Governance ──
  { title: "Governance overview", description: "Company-wide AI usage policy dashboard with compliance score", href: "/dashboard/usage-governance", icon: Landmark, tone: "brand", group: "Usage Governance" },
  { title: "Policy config", description: "Set default actions, data handling rules", href: "/dashboard/usage-governance/policy", icon: SlidersHorizontal, tone: "neutral", group: "Usage Governance" },
  { title: "Provider rules", description: "Allow or block specific AI providers and models", href: "/dashboard/usage-governance/providers", icon: Ban, tone: "neutral", group: "Usage Governance" },
  { title: "Department rules", description: "Per-department AI usage policies", href: "/dashboard/usage-governance/departments", icon: ListChecks, tone: "neutral", group: "Usage Governance" },
  { title: "Data classification", description: "Define what data sensitivity levels can go to which providers", href: "/dashboard/usage-governance/data-classification", icon: ShieldHalf, tone: "neutral", group: "Usage Governance" },
  { title: "Approval requests", description: "Review and manage AI provider access requests with 14-day expiry", href: "/dashboard/usage-governance/approvals", icon: ShieldCheck, tone: "caution", group: "Usage Governance" },
  { title: "Employee monitoring", description: "Track AI usage across your organization", href: "/dashboard/usage-governance/monitoring", icon: Eye, tone: "neutral", group: "Usage Governance" },
  { title: "Audit trail", description: "Complete log of AI usage and policy changes", href: "/dashboard/usage-governance/audit", icon: ScrollText, tone: "neutral", group: "Usage Governance" },
  { title: "Compliance reports", description: "Weekly/monthly/quarterly governance reports with recommendations", href: "/dashboard/usage-governance/reports", icon: FileBarChart, tone: "neutral", group: "Usage Governance" },

  // ── Monitor ──
  { title: "Guard logs", description: "Every input/output guard decision with filters and search", href: "/dashboard/logs", icon: ScrollText, tone: "brand", group: "Monitor" },
  { title: "Reports", description: "Monthly security reports, trends, and recommendations", href: "/dashboard/reports", icon: FileBarChart, tone: "neutral", group: "Monitor" },
  { title: "Detection feedback", description: "Improve accuracy by marking false positives", href: "/dashboard/detection-feedback", icon: Eye, tone: "neutral", group: "Monitor" },

  // ── Security Tools ──
  { title: "AI Code Review", description: "Catch secrets and flaws in AI-generated code", href: "/dashboard/code-security", icon: CodeXml, tone: "brand", group: "Security Tools" },
  { title: "Shadow AI", description: "Discover unauthorized AI tool usage", href: "/dashboard/shadow-ai", icon: EyeOff, tone: "danger", group: "Security Tools" },
  { title: "Red team lab", description: "Test against adversarial prompts and jailbreaks", href: "/dashboard/redteam/lab", icon: Swords, tone: "caution", group: "Security Tools" },
  { title: "Forensics", description: "Investigate incidents with full audit trails", href: "/dashboard/forensics", icon: FileSearch, tone: "neutral", group: "Security Tools" },
  { title: "RAG security", description: "Guard retrieval pipelines and filter risky sources", href: "/dashboard/rag", icon: DatabaseZap, tone: "neutral", group: "Security Tools" },

  // ── Compliance ──
  { title: "Evidence vault", description: "Package SOC 2 / ISO 27001 compliance proof", href: "/dashboard/evidence-vault", icon: BookOpen, tone: "neutral", group: "Compliance" },
  { title: "Credential vault", description: "Server-side credential storage for agents", href: "/dashboard/credentials", icon: Fingerprint, tone: "caution", group: "Compliance" },

  // ── Manage ──
  { title: "Projects", description: "Organize keys, logs, and config by environment", href: "/dashboard/projects", icon: FolderKanban, tone: "neutral", group: "Manage" },
  { title: "API keys", description: "Generate scoped test and live keys", href: "/dashboard/api-keys", icon: KeyRound, tone: "caution", group: "Manage" },
  { title: "Cost firewall", description: "Prevent runaway LLM spending", href: "/dashboard/cost-firewall", icon: Wallet, tone: "neutral", group: "Manage" },
  { title: "Settings", description: "Review guard defaults and configuration", href: "/dashboard/settings", icon: Settings, tone: "neutral", group: "Manage" },
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
  const onboarding = await loadOnboarding();
  const nextAction = nextOnboardingAction(onboarding.items);
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

  // First-run signal: does this project have any API key yet? Drives the guided
  // activation panel shown to brand-new projects (total === 0).
  const apiKeyCount = await db.apiKey.count({ where: { projectId: project.id } });

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
              <PageHeader
        eyebrow="Security overview"
        title="Guard operations"
      />
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

      {/* ── First-run activation guide (new projects only) ── */}
      {total === 0 && (
        <FirstRunGuide
          hasApiKey={apiKeyCount > 0}
          hasActivity={total > 0}
          apiBaseUrl={SITE_URL}
        />
      )}

      <AnimateIn variant="slide-up" delay={1}>
        <UserSuccessCommandCenter
          completed={onboarding.done}
          total={onboarding.total}
          nextAction={nextAction ? { title: nextAction.title, href: nextAction.href } : null}
        />
      </AnimateIn>

      {/* ── Usage Banner ──
          `.danger-card` / `.warn-card` instead of hand-rolled `rounded-2xl
          border-red-500/30 bg-red-500/5` panels. These were the only two
          `rounded-2xl` surfaces left on this page, and they set their own tinted
          border and fill rather than using the shared callout treatment. */}
      {usage.exceeded && (
        <AnimateIn variant="fade-in" delay={1}>
          <div className="danger-card" role="status">
            Monthly request limit exceeded for plan <strong>{project.plan}</strong>. Guarded API calls are now
            blocked with HTTP 429.{" "}
            <Link className="font-medium underline" href="/dashboard/billing">
              Upgrade or review usage →
            </Link>
          </div>
        </AnimateIn>
      )}
      {!usage.exceeded && usage.warning && (
        <AnimateIn variant="fade-in" delay={1}>
          <div className="warn-card" role="status">
            You have used over 80% of the {project.plan} monthly quota.{" "}
            <Link className="font-medium underline" href="/dashboard/billing">
              Plan &amp; usage →
            </Link>
          </div>
        </AnimateIn>
      )}

      {/* ══════════ TWO-PRODUCT HERO CARDS ══════════
          Both cards were gradient panels in per-product accent colours (orange
          and violet) with blurred colour orbs, `rounded-2xl`, a hover lift, and
          a CTA that faded in only on hover — meaning on a touch device the
          primary action was invisible until tapped.

          They are now `.card card-interactive` with the shared metric treatment.
          The counts are the point of these cards; the gradient was not. Metric
          tones are semantic (pending = caution, blocked = danger, reversible =
          good) rather than per-product identity, so the same colour means the
          same thing on both. */}
      <AnimateIn variant="slide-up" delay={1}>
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ── AI Agent Control ── */}
          <Link href="/dashboard/agent-control" className="card card-interactive group p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/60 text-slate-300">
                <Gauge size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-100">AI Agent Control</p>
                <p className="text-xs text-slate-500">For AI agents using email, CRM, database, payments</p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Action ledger with reversibility classification, rollback windows, continuous compliance
              assurance.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <HeroStat label="Pending" value={agentPending} tone={agentPending > 0 ? "caution" : "neutral"} />
              <HeroStat label="Blocked" value={agentBlocked} tone={agentBlocked > 0 ? "danger" : "neutral"} />
              <HeroStat label="Reversible" value={agentReversible} tone="good" />
            </div>

            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
              Open control center
              <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          {/* ── AI Usage Governance ── */}
          <Link href="/dashboard/usage-governance" className="card card-interactive group p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/60 text-slate-300">
                <Landmark size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-slate-100">AI Usage Governance</p>
                <p className="text-xs text-slate-500">For employees using ChatGPT, Claude, Cursor</p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Five-step governance engine, provider allow/block lists, department rules, employee DLP
              monitoring.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <HeroStat
                label="Compliance"
                value={`${govCompliance}%`}
                tone={govCompliance >= 80 ? "good" : govCompliance >= 50 ? "caution" : "danger"}
              />
              <HeroStat label="Blocked" value={govBlocked} tone={govBlocked > 0 ? "danger" : "neutral"} />
              <HeroStat label="Pending" value={govPending} tone={govPending > 0 ? "caution" : "neutral"} />
            </div>

            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
              Open governance dashboard
              <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </AnimateIn>

      {/* ── System Health ──
          The plan/usage tile was the only card on the page with its own hover
          glow (`hover:border-cyan/30 hover:shadow-cyan/5`) despite not being a
          link — one of the false affordances Phase 1 removed elsewhere. Its
          status pill is now a shared `.badge-*` variant instead of a bespoke
          `rounded-full bg-x-400/10` triplet, and the usage meter matches the one
          `BarList`/`CompositionBar` use. */}
      <AnimateIn variant="slide-up" delay={2}>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Plan</p>
                <p className="mt-1 text-2xl font-semibold text-slate-100">{project.plan}</p>
              </div>
              <span className={usage.exceeded ? "badge-danger" : usage.warning ? "badge-warning" : "badge-success"}>
                {usage.exceeded ? "Exceeded" : usage.warning ? "Warning" : "Healthy"}
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-400">Monthly usage</span>
                <span data-numeric className="text-slate-400">
                  {usage.used.toLocaleString("en-IN")} / {usage.limit.toLocaleString("en-IN")}
                </span>
              </div>
              {/* The figures above carry the value, so the meter is presentational
                  — announcing it again would duplicate the reading. */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800" role="presentation">
                <div
                  className={`h-full rounded-full ${
                    usage.exceeded ? "bg-rose-400/80" : usage.warning ? "bg-amber-400/80" : "bg-cyan/70"
                  }`}
                  style={{ width: `${Math.min(100, Math.round(usage.ratio * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <MetricCard label="Total requests" value={total} hint="All guard decisions on this project" />
          <MetricCard
            label="Avg risk score"
            value={avgRisk}
            tone={avgRisk > 60 ? "red" : avgRisk > 30 ? "yellow" : "green"}
            hint="Mean across every decision"
          />
          <MetricCard
            label="Top risk"
            value={topRisk}
            tone={topRisk.includes("CRITICAL") ? "red" : "yellow"}
            hint="Most frequent category this month"
          />
        </section>
      </AnimateIn>

      {/* ── Guard Stats + decision composition ──
          `CompositionBar` replaces what would otherwise be three unrelated counts
          with no sense of proportion: "142 blocked" means something different
          against 200 total requests than against 200,000. The three StatCards
          keep the absolute figures; the bar supplies the ratio. */}
      <AnimateIn variant="slide-up" delay={3}>
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Blocked requests" value={blocked} icon={Ban} />
            <StatCard label="PII redactions" value={piiRedactions} icon={UserRoundX} />
            <StatCard label="Secrets prevented" value={secrets} icon={DatabaseZap} />
          </div>

          {total > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-slate-100">Decision mix</h2>
              <p className="mt-1 text-sm text-slate-400">
                Share of all {total.toLocaleString("en-IN")} guard decisions on this project.
              </p>
              <CompositionBar
                className="mt-4"
                label="Guard decisions"
                segments={[
                  { label: "Blocked", value: blocked, tone: "danger" },
                  { label: "Redacted", value: piiRedactions, tone: "warning" },
                  // Everything not blocked or redacted passed through. Derived
                  // rather than queried: a fourth COUNT on every dashboard load
                  // is not worth it when the arithmetic is exact.
                  { label: "Allowed", value: Math.max(0, total - blocked - piiRedactions), tone: "brand" },
                ]}
              />
            </div>
          )}
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
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-100">
              <Activity size={16} aria-hidden="true" className="text-slate-400" />
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
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">All features</h2>
              <p className="mt-1 text-sm text-slate-400">
                {FEATURE_CARDS.length} features across {groups.length} areas
              </p>
            </div>
            <Link href="/dashboard/onboarding" className="text-sm font-semibold text-cyan hover:underline">
              Guided setup →
            </Link>
          </div>

          {groups.map((group) => (
            <div key={group} className="mb-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-300">
                {group}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURE_CARDS.filter((c) => c.group === group).map((card) => {
                  const Icon = card.icon;
                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="card card-interactive group flex items-start gap-3 p-4"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/60 ${TONE_CLASS[card.tone]}`}
                      >
                        <Icon size={17} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-100">{card.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">{card.description}</span>
                      </span>
                      <ArrowRight
                        size={14}
                        aria-hidden="true"
                        className="mt-1 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400"
                      />
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
