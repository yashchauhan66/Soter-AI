import { Activity, Users, Globe, ShieldBan, ShieldAlert, Clock, ArrowUpRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Request-time window boundaries. Hoisted out of the component render body so
// the React purity lint does not flag the per-request clock read.
function windowStart(days: number): Date {
  const now = Date.now();
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

export default async function GovernanceMonitoringPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const thirtyDaysAgo = windowStart(30);
  const sevenDaysAgo = windowStart(7);

  const [
    recentLogs,
    usageStats,
    providerStats,
    enforcementEvents,
    enforcementByProvider,
    recentEnforcement,
  ] = await Promise.all([
    // All audit logs (existing)
    db.aiUsageGovernanceAuditLog.findMany({
      where: {
        organizationId: active.org.id,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // Decision breakdown (existing)
    db.aiUsageGovernanceAuditLog.groupBy({
      by: ["decision"],
      where: {
        organizationId: active.org.id,
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    }),
    // Provider usage (existing)
    db.aiUsageGovernanceAuditLog.groupBy({
      by: ["providerName"],
      where: {
        organizationId: active.org.id,
        providerName: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    // ── Governance enforcement: blocked / denied events ──
    db.aiUsageGovernanceAuditLog.findMany({
      where: {
        organizationId: active.org.id,
        decision: { in: ["BLOCKED", "BLOCK", "DENIED"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    // Enforcement grouped by provider
    db.aiUsageGovernanceAuditLog.groupBy({
      by: ["providerName"],
      where: {
        organizationId: active.org.id,
        providerName: { not: null },
        decision: { in: ["BLOCKED", "BLOCK", "DENIED"] },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    // Recent enforcement events (last 7 days, for the alert timeline)
    db.aiUsageGovernanceAuditLog.findMany({
      where: {
        organizationId: active.org.id,
        decision: { in: ["BLOCKED", "BLOCK", "DENIED"] },
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        providerName: true,
        modelName: true,
        action: true,
        decision: true,
        reason: true,
        createdAt: true,
      },
    }),
  ]);

  // ── Derived stats ──

  const totalUsage = recentLogs.length;
  const allowedCount = usageStats.find((s) => s.decision === "ALLOWED" || s.decision === "ALLOW")?._count.id ?? 0;
  const blockedCount = usageStats.find((s) => s.decision === "BLOCKED" || s.decision === "BLOCK")?._count.id ?? 0;
  const enforcementCount = enforcementEvents.length;

  // Unique blocked providers
  const uniqueBlockedProviders = new Set(
    enforcementEvents.filter((e) => e.providerName).map((e) => e.providerName),
  );

  // Most common block reason
  const reasonCounts = new Map<string, number>();
  for (const event of enforcementEvents) {
    if (event.reason) {
      const shortReason = event.reason.length > 80 ? event.reason.slice(0, 80) + "…" : event.reason;
      reasonCounts.set(shortReason, (reasonCounts.get(shortReason) ?? 0) + 1);
    }
  }
  const topReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Block rate percentage
  const blockRate = totalUsage > 0 ? Math.round((blockedCount / totalUsage) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 text-3xl font-bold">Employee AI Usage Monitoring</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Monitor AI tool usage across your organization. Track which providers are being used,
          how often, and whether usage complies with your governance policies.
        </p>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-5">
          <Activity className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Total usage (30 days)</p>
          <p className="mt-1 text-2xl font-bold">{totalUsage}</p>
        </div>
        <div className="card p-5">
          <Users className="mb-2 text-emerald-400" size={20} />
          <p className="text-sm text-slate-400">Allowed</p>
          <p className="mt-1 text-2xl font-bold">{allowedCount}</p>
        </div>
        <div className="card p-5">
          <Globe className="mb-2 text-red-400" size={20} />
          <p className="text-sm text-slate-400">Blocked</p>
          <p className="mt-1 text-2xl font-bold">{blockedCount}</p>
        </div>
        <div className="card p-5">
          <ShieldBan className="mb-2 text-rose-400" size={20} />
          <p className="text-sm text-slate-400">Block rate</p>
          <p className="mt-1 text-2xl font-bold">{blockRate}%</p>
        </div>
      </div>

      {/* ── Governance Enforcement Alerts ── */}
      <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-rose-400" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-rose-100">Governance Enforcement Alerts</h2>
              <p className="text-sm text-slate-400">
                AI provider access attempts blocked by governance policy in the last 30 days
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/usage-governance/audit"
            className="flex items-center gap-1 text-sm text-cyan underline underline-offset-2 hover:text-cyan/80"
          >
            Audit log <ArrowUpRight size={14} />
          </Link>
        </div>

        {/* Enforcement summary cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-2xl font-bold text-rose-200">{enforcementCount}</p>
            <p className="mt-1 text-xs text-slate-400">Total blocked</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-2xl font-bold text-rose-200">{uniqueBlockedProviders.size}</p>
            <p className="mt-1 text-xs text-slate-400">Providers blocked</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 sm:col-span-2">
            {topReason ? (
              <>
                <p className="text-xs text-slate-400">Most common block reason</p>
                <p className="mt-1 text-sm font-medium text-amber-200">{topReason[0]}</p>
                <p className="mt-0.5 text-xs text-slate-500">{topReason[1]} occurrence(s)</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">No blocks recorded yet</p>
            )}
          </div>
        </div>

        {/* Blocked providers breakdown */}
        {enforcementByProvider.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-300">Blocked by provider</h3>
            <div className="space-y-2">
              {enforcementByProvider.map((stat) => {
                const maxCount = enforcementByProvider[0]._count.id;
                const pct = maxCount > 0 ? (stat._count.id / maxCount) * 100 : 0;
                return (
                  <div className="flex items-center gap-3" key={stat.providerName ?? "unknown"}>
                    <span className="w-32 shrink-0 text-sm font-medium text-slate-300">
                      {stat.providerName}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-semibold text-rose-300">
                      {stat._count.id}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent enforcement timeline (last 7 days) */}
        {recentEnforcement.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <Clock size={14} className="text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-300">Recent blocks (7 days)</h3>
            </div>
            <div className="space-y-2">
              {recentEnforcement.map((event) => (
                <div
                  className="flex items-start gap-3 rounded-xl border border-rose-500/10 bg-rose-500/5 p-3 text-sm"
                  key={event.id}
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {event.providerName && (
                        <span className="font-semibold text-rose-200">{event.providerName}</span>
                      )}
                      {event.modelName && (
                        <span className="text-xs text-slate-500">({event.modelName})</span>
                      )}
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-300">
                        {event.decision}
                      </span>
                    </div>
                    {event.reason && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {event.reason.length > 150 ? event.reason.slice(0, 150) + "…" : event.reason}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-600">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {enforcementCount === 0 && (
          <div className="mt-6 text-center text-sm text-slate-500">
            <ShieldBan size={32} className="mx-auto mb-2 text-slate-600" />
            <p>No governance enforcement events recorded in the last 30 days.</p>
            <p className="mt-1 text-xs text-slate-600">
              When a governance policy blocks an AI provider or requires approval, the event will
              appear here.
            </p>
          </div>
        )}
      </section>

      {/* ── Top AI Providers ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Top AI Providers (30 days)</h2>
        {providerStats.length === 0 ? (
          <p className="text-sm text-slate-500">No provider usage tracked in the last 30 days.</p>
        ) : (
          <div className="space-y-2">
            {providerStats.map((stat) => (
              <div className="card flex items-center justify-between p-4" key={stat.providerName ?? "unknown"}>
                <span className="font-medium">{stat.providerName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-cyan font-semibold">{stat._count.id} events</span>
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan"
                      style={{ width: `${totalUsage > 0 ? (stat._count.id / totalUsage) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Recent Activity ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Recent Activity</h2>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-slate-500">No recent activity tracked.</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div className="card flex items-start gap-3 p-3 text-sm" key={log.id}>
                <span
                  className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    log.decision === "ALLOWED" || log.decision === "ALLOW"
                      ? "bg-emerald-400"
                      : log.decision === "BLOCKED" || log.decision === "BLOCK"
                        ? "bg-red-400"
                        : "bg-amber-400"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {log.providerName && <span className="font-medium">{log.providerName}</span>}
                    <span className="text-xs text-slate-500">{log.action.replace(/_/g, " ")}</span>
                    <span
                      className={`text-xs font-medium ${
                        log.decision === "ALLOWED" || log.decision === "ALLOW"
                          ? "text-emerald-400"
                          : log.decision === "BLOCKED" || log.decision === "BLOCK"
                            ? "text-red-400"
                            : "text-amber-400"
                      }`}
                    >
                      {log.decision}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
