import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Banknote,
  BellRing,
  Bot,
  Boxes,
  Clock3,
  Database,
  FileWarning,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { getVectorProvider } from "@/lib/rag/vector/vectorProvider";
import { checkSecretStoreHealth } from "@/lib/secrets/secretStoreHealth";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminRealtimeRefresh } from "@/components/admin/AdminRealtimeRefresh";
import { AdminServiceLauncher } from "@/components/admin/AdminServiceLauncher";
import type { AdminBadgeCounts } from "@/components/admin/adminNav";

export const dynamic = "force-dynamic";

function numberFormat(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function compactDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

function timeAgo(date: Date | string | null | undefined) {
  if (!date) return "Never";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function barHeight(value: number, max: number) {
  if (!max) return 8;
  return Math.max(8, Math.round((value / max) * 72));
}

const toneClasses: Record<string, string> = {
  cyan: "border-cyan/20 bg-cyan/5 text-cyan",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  red: "border-red-500/25 bg-red-500/10 text-red-200",
  slate: "border-slate-700 bg-slate-900/50 text-slate-300",
};

function healthTone(ok: boolean) {
  return ok ? toneClasses.emerald : toneClasses.red;
}

export default async function AdminOverviewPage() {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since1h = new Date(now.getTime() - 60 * 60 * 1000);

  const [
    totalUsers,
    totalOrgs,
    totalProjects,
    totalLogs,
    logs24h,
    logs1h,
    blocked24h,
    redacted24h,
    review24h,
    avgRisk24h,
    failedDeliveries,
    failedDeliveries24h,
    totalDeliveries24h,
    pendingApprovals,
    openTickets,
    unresolvedFeedback,
    activeSubs,
    billingFailures24h,
    activePolicies,
    lockedOrgs,
    activeEnrollmentTokens,
    activeExtensionDevices,
    shadowFindings24h,
    fileEvents24h,
    ragIndexedDocs,
    ragQuarantinedDocs,
    ragTrustIssues,
    failedJobs24h,
    pendingJobs,
    siemFailures24h,
    recentOrgs,
    recentEvents,
    disabledProjects,
    recentFeedback,
    recentAdminAudits,
    recentLogs,
    groupedProjects,
    mlReviewQueue,
    kms,
    vector,
    databaseHealth,
    redisHealth,
  ] = await Promise.all([
    db.user.count(),
    db.organization.count(),
    db.project.count(),
    db.guardLog.count(),
    db.guardLog.count({ where: { createdAt: { gte: since24h } } }),
    db.guardLog.count({ where: { createdAt: { gte: since1h } } }),
    db.guardLog.count({ where: { action: "BLOCK", createdAt: { gte: since24h } } }),
    db.guardLog.count({ where: { action: "ALLOW_WITH_REDACTION", createdAt: { gte: since24h } } }),
    db.guardLog.count({ where: { action: "HUMAN_REVIEW", createdAt: { gte: since24h } } }),
    db.guardLog.aggregate({ where: { createdAt: { gte: since24h } }, _avg: { riskScore: true } }),
    db.webhookDelivery.count({ where: { status: { in: ["FAILED", "DEAD_LETTER"] } } }),
    db.webhookDelivery.count({ where: { status: { in: ["FAILED", "DEAD_LETTER"] }, createdAt: { gte: since24h } } }),
    db.webhookDelivery.count({ where: { createdAt: { gte: since24h } } }),
    db.aiUsageApprovalRequest.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: { not: "CLOSED" } } }),
    db.detectionFeedback.count({ where: { review: null } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.paymentEvent.count({ where: { eventType: { in: ["payment.failed", "subscription.halted"] }, receivedAt: { gte: since24h } } }),
    db.aiAdminPolicy.count({ where: { enabled: true } }),
    db.emergencyLockdownState.count({ where: { enabled: true } }),
    db.extensionEnrollmentToken.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    db.deviceAgent.count({ where: { status: "active" } }),
    db.shadowAiFinding.count({ where: { createdAt: { gte: since24h } } }),
    db.aIFileScanEvent.count({ where: { createdAt: { gte: since24h } } }),
    db.ragDocument.count({ where: { status: "INDEXED" } }),
    db.ragDocument.count({ where: { status: "QUARANTINED" } }),
    db.ragDocumentTrust.count({ where: { trustLevel: { in: ["SUSPICIOUS", "NEEDS_REVIEW", "QUARANTINED"] } } }),
    db.backgroundJob.count({ where: { status: "FAILED", createdAt: { gte: since24h } } }),
    db.backgroundJob.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    db.siemDelivery.count({ where: { status: "FAILED", createdAt: { gte: since24h } } }),
    db.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { _count: { select: { projects: true, members: true } }, subscription: true },
    }),
    db.paymentEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 8 }),
    db.project.count({ where: { disabledAt: { not: null } } }),
    db.detectionFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { project: { select: { name: true } } } }),
    db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { adminUser: { select: { email: true } } } }),
    db.guardLog.findMany({ where: { createdAt: { gte: since24h } }, orderBy: { createdAt: "asc" }, select: { createdAt: true, action: true, riskScore: true }, take: 1200 }),
    db.guardLog.groupBy({ by: ["projectId"], where: { createdAt: { gte: since24h } }, _count: { _all: true }, _avg: { riskScore: true } }),
    db.mLReviewQueue.count({ where: { status: "PENDING" } }),
    checkSecretStoreHealth(),
    getVectorProvider()
      .then((provider) => provider.healthCheck())
      .catch((error) => ({ provider: "unknown", healthy: false, configured: false, latencyMs: 0, message: error instanceof Error ? error.message : "Vector unavailable" })),
    db.$queryRaw`SELECT 1`
      .then(() => ({ ok: true, message: "Postgres reachable" }))
      .catch((error) => ({ ok: false, message: error instanceof Error ? error.message : "Postgres unavailable" })),
    getRedis()
      .get("soter:admin:health")
      .then(() => ({ ok: true, message: "Redis reachable" }))
      .catch((error) => ({ ok: false, message: error instanceof Error ? error.message : "Redis unavailable" })),
  ]);

  const hourly = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(now.getTime() - (11 - index) * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const items = recentLogs.filter((item) => item.createdAt >= start && item.createdAt < end);
    return { label: start.getHours().toString().padStart(2, "0"), total: items.length, blocked: items.filter((item) => item.action === "BLOCK").length };
  });
  const maxHourly = Math.max(...hourly.map((item) => item.total), 0);
  const topProjects = groupedProjects.sort((a, b) => b._count._all - a._count._all).slice(0, 5);

  const healthCards = [
    { label: "Database", ok: databaseHealth.ok, detail: databaseHealth.message, icon: Database },
    { label: "KMS", ok: kms.healthy, detail: kms.healthy ? `${kms.provider} ${kms.latencyMs}ms` : kms.message, icon: LockKeyhole },
    { label: "Vector", ok: vector.healthy, detail: vector.healthy ? `${vector.provider} ${vector.latencyMs}ms` : vector.message, icon: Boxes },
    { label: "Redis", ok: redisHealth.ok, detail: redisHealth.message, icon: RadioTower },
  ];

  const criticalAlerts = [
    ...(failedDeliveries24h ? [{ label: "Webhook failures", value: failedDeliveries24h, href: "/admin/integrations/siem-webhooks", tone: "red" }] : []),
    ...(failedJobs24h ? [{ label: "Failed jobs", value: failedJobs24h, href: "/admin/production", tone: "red" }] : []),
    ...(lockedOrgs ? [{ label: "Emergency lockdown active", value: lockedOrgs, href: "/admin/ai-policies/emergency-lockdown", tone: "amber" }] : []),
    ...(pendingApprovals ? [{ label: "Approval queue", value: pendingApprovals, href: "/admin/approvals", tone: "amber" }] : []),
    ...(ragQuarantinedDocs ? [{ label: "Quarantined RAG docs", value: ragQuarantinedDocs, href: "/dashboard/agent-firewall/rag-trust", tone: "amber" }] : []),
  ].slice(0, 5);

  const executiveCards = [
    { label: "Users", value: totalUsers, detail: `${numberFormat(totalOrgs)} orgs`, icon: Users, tone: "cyan" },
    { label: "Projects", value: totalProjects, detail: `${numberFormat(disabledProjects)} disabled`, icon: Workflow, tone: disabledProjects ? "amber" : "emerald" },
    { label: "Requests 24h", value: logs24h, detail: `${numberFormat(logs1h)} in last hour`, icon: Activity, tone: "cyan" },
    { label: "Total logs", value: totalLogs, detail: "all time", icon: Database, tone: "slate" },
    { label: "Blocks 24h", value: blocked24h, detail: `${percent(blocked24h, logs24h)} block rate`, icon: ShieldAlert, tone: blocked24h ? "red" : "emerald" },
    { label: "Redactions", value: redacted24h, detail: `${numberFormat(review24h)} human reviews`, icon: Fingerprint, tone: redacted24h ? "amber" : "slate" },
    { label: "Avg risk", value: Math.round(avgRisk24h._avg.riskScore ?? 0), detail: "rolling 24h", icon: Zap, tone: (avgRisk24h._avg.riskScore ?? 0) > 60 ? "red" : "emerald" },
    { label: "Billing", value: activeSubs, detail: `${numberFormat(billingFailures24h)} failures 24h`, icon: Banknote, tone: billingFailures24h ? "red" : "emerald" },
    { label: "Webhooks", value: failedDeliveries, detail: `${percent(failedDeliveries24h, totalDeliveries24h)} failure 24h`, icon: BellRing, tone: failedDeliveries24h ? "red" : "emerald" },
    { label: "AI policies", value: activePolicies, detail: `${numberFormat(pendingApprovals)} approvals`, icon: ShieldCheck, tone: pendingApprovals ? "amber" : "emerald" },
    { label: "Extension fleet", value: activeExtensionDevices, detail: `${numberFormat(activeEnrollmentTokens)} enrollment tokens`, icon: Bot, tone: "cyan" },
    { label: "RAG trust", value: ragIndexedDocs, detail: `${numberFormat(ragTrustIssues)} trust issues`, icon: FileWarning, tone: ragTrustIssues ? "amber" : "emerald" },
    { label: "Support", value: openTickets, detail: `${numberFormat(unresolvedFeedback)} unresolved feedback`, icon: AlertTriangle, tone: openTickets ? "amber" : "emerald" },
  ];

  const launcherCounts: AdminBadgeCounts = {
    pendingApprovals,
    openTickets,
    unresolvedFeedback,
    failedDeliveries24h,
    failedJobs24h,
    shadowFindings24h,
    mlReviewQueue,
    lockedOrgs,
  };

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">Platform command center</p>
          <h1 className="mt-2 text-3xl font-bold">Admin dashboard</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Live operational posture across security events, tenant health, billing, workers, approvals, RAG trust, KMS, and integration delivery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
            Updated <span className="font-mono text-slate-200">{compactDate(now)}</span>
          </div>
          <AdminRealtimeRefresh />
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-4">
        {healthCards.map(({ label, ok, detail, icon: Icon }) => (
          <section className={`rounded-lg border p-4 ${healthTone(ok)}`} key={label}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</p>
                <p className="mt-2 text-lg font-semibold">{ok ? "Healthy" : "Attention"}</p>
                <p className="mt-1 line-clamp-2 text-xs opacity-80">{detail}</p>
              </div>
              <Icon size={20} />
            </div>
          </section>
        ))}
      </div>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {executiveCards.map(({ label, value, detail, icon: Icon, tone }) => (
            <div className="card p-4" key={label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{numberFormat(Number(value))}</p>
                  <p className="mt-1 text-xs text-slate-500">{detail}</p>
                </div>
                <span className={`rounded-md border p-2 ${toneClasses[tone]}`}><Icon size={17} /></span>
              </div>
            </div>
          ))}
        </div>

        <aside className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Priority queue</p>
              <h2 className="mt-2 text-lg font-semibold">Needs attention</h2>
            </div>
            <span className="rounded-md border border-slate-700 bg-slate-950/70 p-2 text-slate-300"><Clock3 size={16} /></span>
          </div>
          <div className="mt-4 space-y-3">
            {criticalAlerts.length ? criticalAlerts.map((item) => (
              <Link href={item.href} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 transition hover:border-cyan/40" key={item.label}>
                <span className="text-sm text-slate-300">{item.label}</span>
                <span className={`rounded-md px-2 py-1 text-xs font-bold ${toneClasses[item.tone]}`}>{numberFormat(item.value)}</span>
              </Link>
            )) : (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">No urgent operational alerts right now.</div>
            )}
          </div>
          <div className="mt-5 border-t border-slate-800 pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Detection volume, 12h</p>
            <div className="mt-3 flex h-24 items-end gap-2">
              {hourly.map((hour) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={hour.label}>
                  <div className="flex h-20 w-full items-end justify-center rounded bg-slate-950/70 px-1">
                    <div
                      className={`w-full rounded-t ${hour.blocked ? "bg-red-400" : "bg-cyan"}`}
                      style={{ height: barHeight(hour.total, maxHourly) }}
                      title={`${hour.label}:00 - ${hour.total} requests, ${hour.blocked} blocked`}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-slate-500">{hour.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <div>
              <p className="eyebrow">Tenants</p>
              <h2 className="mt-1 text-lg font-semibold">Recent organizations</h2>
            </div>
            <Link href="/admin/organizations" className="text-sm font-semibold text-cyan hover:text-cyan/80">View all</Link>
          </div>
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Projects</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentOrgs.map((org) => (
                <tr key={org.id}>
                  <td className="px-4 py-3 font-semibold">{org.name}</td>
                  <td className="px-4 py-3">{org.type}</td>
                  <td className="px-4 py-3">{org.plan}</td>
                  <td className="px-4 py-3">{org.subscription?.status ?? "-"}</td>
                  <td className="px-4 py-3">{org._count.members}</td>
                  <td className="px-4 py-3">{org._count.projects}</td>
                  <td className="px-4 py-3 text-slate-500">{timeAgo(org.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Risk leaders</p>
              <h2 className="mt-1 text-lg font-semibold">Top active projects</h2>
            </div>
            <Link href="/admin/projects" className="text-sm font-semibold text-cyan hover:text-cyan/80">Projects</Link>
          </div>
          <div className="mt-4 space-y-3">
            {topProjects.length ? topProjects.map((project) => (
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3" key={project.projectId}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-mono text-xs text-slate-300">{project.projectId}</p>
                  <span className="rounded-md bg-cyan/10 px-2 py-1 text-xs font-bold text-cyan">{numberFormat(project._count._all)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Average risk {Math.round(project._avg.riskScore ?? 0)}</p>
              </div>
            )) : (
              <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">No request traffic in the last 24 hours.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <div>
              <p className="eyebrow">Revenue</p>
              <h2 className="mt-1 text-lg font-semibold">Recent payment events</h2>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs font-bold ${billingFailures24h ? toneClasses.red : toneClasses.emerald}`}>{billingFailures24h} failures</span>
          </div>
          {recentEvents.length ? (
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Org</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-slate-400">{timeAgo(event.receivedAt)}</td>
                    <td className="px-4 py-3">{event.organizationId ?? "-"}</td>
                    <td className="px-4 py-3">{event.eventType}</td>
                    <td className={`px-4 py-3 ${event.signatureValid ? "text-emerald-300" : "text-red-300"}`}>{event.signatureValid ? "valid" : "invalid"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-5 text-sm text-slate-500">No payment events yet.</p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Quality</p>
                <h2 className="mt-1 font-semibold">Recent detection feedback</h2>
              </div>
              <Link href="/admin/detection-quality" className="text-sm font-semibold text-cyan hover:text-cyan/80">Review</Link>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {recentFeedback.length ? recentFeedback.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <p>{item.feedback} <span className="text-slate-500">- {item.project.name}</span></p>
                  <p className="mt-1 text-xs text-slate-500">{item.note ?? "No note"} - {timeAgo(item.createdAt)}</p>
                </div>
              )) : <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">No feedback submitted yet.</p>}
            </div>
          </section>
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Governance</p>
                <h2 className="mt-1 font-semibold">Recent admin audit</h2>
              </div>
              <KeyRound size={17} className="text-amber-300" />
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {recentAdminAudits.length ? recentAdminAudits.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <p>{item.action} <span className="text-slate-500">- {item.targetType}</span></p>
                  <p className="mt-1 text-xs text-slate-500">{item.adminUser?.email ?? "system"} - {item.reason} - {timeAgo(item.createdAt)}</p>
                </div>
              )) : <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">No admin actions recorded.</p>}
            </div>
          </section>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Shadow AI findings", shadowFindings24h, "/admin/shadow-ai"],
          ["File scan events", fileEvents24h, "/admin/file-scan-events"],
          ["SIEM failures", siemFailures24h, "/admin/integrations/siem-webhooks"],
          ["Worker backlog", pendingJobs, "/admin/production"],
        ].map(([label, value, href]) => (
          <Link href={String(href)} className="card p-5 transition hover:border-cyan/40" key={String(label)}>
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{numberFormat(Number(value))}</p>
          </Link>
        ))}
      </section>

      <AdminServiceLauncher counts={launcherCounts} />

      <AdminActionForm />
    </div>
  );
}
