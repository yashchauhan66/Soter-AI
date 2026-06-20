import { Banknote, Ban, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getCostSummary, listBudgets } from "@/lib/cost-firewall";

export const dynamic = "force-dynamic";

export default async function CostFirewallPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, _projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  await requireProjectPermission(project.id, "cost:read");

  const orgId = project.organizationId ?? "";
  const [summary, budgets, anomalies, throttles] = await Promise.all([
    getCostSummary(orgId, project.id),
    listBudgets(orgId),
    db.usageAnomaly.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.throttleEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalInRupees = (summary.totalPaise / 100).toFixed(2);
  const projectBudget = budgets.find((b) => b.projectId === project.id);
  const activeThrottles = throttles.filter(
    (t) => !t.expiresAt || t.expiresAt > new Date(),
  );

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">Cost control</p>
        <h1 className="mt-2 text-3xl font-bold">AI Cost Firewall</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Monitor, budget, and control AI API spending across providers and models.
          Set hard or soft budget limits, detect cost anomalies, and auto-throttle
          when spending spikes beyond normal patterns.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-5">
          <Banknote className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Month-to-date cost</p>
          <p className="mt-1 text-2xl font-bold">₹{totalInRupees}</p>
          <p className="text-xs text-slate-500">{summary.totalTransactions} transactions</p>
        </div>
        <div className="card p-5">
          <TrendingUp className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Budget status</p>
          <p className="mt-1 text-2xl font-bold">
            {projectBudget
              ? `${Math.round(projectBudget.usagePercent)}%`
              : "No budget set"}
          </p>
          {projectBudget && (
            <p className="text-xs text-slate-500">
              ₹{((projectBudget.monthlyLimitPaise ?? 0) / 100).toFixed(2)} limit
            </p>
          )}
        </div>
        <div className="card p-5">
          <AlertTriangle className="mb-2 text-amber-300" size={20} />
          <p className="text-sm text-slate-400">Anomalies</p>
          <p className="mt-1 text-2xl font-bold">{anomalies.length}</p>
        </div>
        <div className="card p-5">
          <Ban className={`mb-2 ${activeThrottles.length > 0 ? "text-rose-300" : "text-slate-500"}`} size={20} />
          <p className="text-sm text-slate-400">Active throttles</p>
          <p className="mt-1 text-2xl font-bold">{activeThrottles.length}</p>
        </div>
      </div>

      {projectBudget?.warning && !projectBudget.exceeded && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          Budget alert: {projectBudget.usagePercent.toFixed(0)}% of monthly budget used.
          <Link className="ml-1 underline" href={`/dashboard/cost-firewall/budget?project=${project.id}`}>
            Adjust budget →
          </Link>
        </div>
      )}
      {projectBudget?.exceeded && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
          Monthly budget exceeded{" "}
          {projectBudget.hardStop ? "(hard stop enabled)" : "(soft limit)"}.
          <Link className="ml-1 underline" href={`/dashboard/cost-firewall/budget?project=${project.id}`}>
            Review budget →
          </Link>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-semibold">Spending by provider</h2>
          <div className="space-y-2">
            {summary.byProvider.map((p) => (
              <div className="card flex items-center justify-between p-4" key={p.name}>
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.count} transactions</p>
                </div>
                <p className="font-semibold">₹{(p.totalPaise / 100).toFixed(2)}</p>
              </div>
            ))}
            {summary.byProvider.length === 0 && (
              <p className="text-sm text-slate-500">No spending recorded this month.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Spending by model</h2>
          <div className="space-y-2">
            {summary.byModel.map((m) => (
              <div className="card flex items-center justify-between p-4" key={m.name}>
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.count} calls</p>
                </div>
                <p className="font-semibold">₹{(m.totalPaise / 100).toFixed(2)}</p>
              </div>
            ))}
            {summary.byModel.length === 0 && (
              <p className="text-sm text-slate-500">No model spending recorded this month.</p>
            )}
          </div>
        </section>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold">Budgets</h2>
        <div className="mt-4 space-y-3">
          {budgets.length === 0 && (
            <p className="text-sm text-slate-500">
              No budgets configured. Set a budget to control AI API spending.
            </p>
          )}
          {budgets.map((b) => (
            <div className="flex items-center justify-between border-b border-slate-800 pb-3" key={b.id}>
              <div>
                <p className="text-sm font-medium">
                  {b.projectId ? `Project: ${b.projectId.slice(0, 8)}...` : "Organization-wide"}
                </p>
                <p className="text-xs text-slate-500">
                  ₹{((b.monthlyLimitPaise ?? 0) / 100).toFixed(2)} limit ·{" "}
                  {b.hardStop ? "Hard stop" : "Soft limit"} · Alert at{" "}
                  {Math.round((b.alertThreshold ?? 0.8) * 100)}%
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  b.exceeded
                    ? "bg-rose-500/15 text-rose-300"
                    : b.warning
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {b.exceeded ? "Exceeded" : b.warning ? "Warning" : "OK"}
              </span>
            </div>
          ))}
        </div>
        {budgets.length > 0 && (
          <Link
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan/90"
            href={`/dashboard/cost-firewall/budget?project=${project.id}`}
          >
            Manage budgets
          </Link>
        )}
      </div>

      {anomalies.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Recent anomalies</h2>
          <div className="space-y-2">
            {anomalies.slice(0, 5).map((a) => (
              <div className="card flex items-center justify-between p-4" key={a.id}>
                <div>
                  <p className="text-sm font-medium">
                    {a.metric} · baseline: {a.baseline}, observed: {a.observed}
                  </p>
                  <p className="text-xs text-slate-500">{a.createdAt.toLocaleString()}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    a.severity === "CRITICAL"
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {a.severity}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
