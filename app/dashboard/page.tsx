import { Ban, DatabaseZap, Gauge, ScanLine, ShieldCheck, UserRoundX } from "lucide-react";
import Link from "next/link";
import { LogsTable } from "@/components/dashboard/LogsTable";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { RiskChart } from "@/components/dashboard/RiskChart";
import { StatCard } from "@/components/dashboard/StatCard";
import { UsageCard } from "@/components/dashboard/UsageCard";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { db } from "@/lib/db";
import { guardLogListSelect } from "@/lib/guard/logSelect";
import { checkMonthlyLimit } from "@/lib/rateLimit";
import { recordRequestMetric } from "@/lib/ops/monitoring";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const startedAt = Date.now();
  const params = await searchParams;
  const [project, projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const usage = await checkMonthlyLimit(project.id, project.plan);
  const [logs, riskRows, aggregate, total, blocked, piiRedactions, secrets] = await Promise.all([
    db.guardLog.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" }, take: 8, select: guardLogListSelect }),
    db.guardLog.findMany({
      where: { projectId: project.id, createdAt: { gte: monthStart } },
      select: { riskTypes: true },
      orderBy: { createdAt: "desc" },
      take: 2_000,
    }),
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

  const risks = new Map<string, number>();
  riskRows
    .flatMap((row) => row.riskTypes)
    .filter((type) => type !== "LOW_RISK")
    .forEach((type) => risks.set(type, (risks.get(type) ?? 0) + 1));
  const riskData = [...risks]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));
  void recordRequestMetric("dashboard_latency_ms", Date.now() - startedAt);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Security overview</p>
          <h1 className="mt-2 text-3xl font-bold">Guard operations</h1>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      {usage.exceeded && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
          Monthly request limit exceeded for plan <strong>{project.plan}</strong>. Guarded API calls are now blocked
          with HTTP 429. <Link className="underline" href="/dashboard/billing">Upgrade or review usage →</Link>
        </div>
      )}
      {!usage.exceeded && usage.warning && (
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          You have used over 80% of the {project.plan} monthly quota.
          <Link className="ml-1 underline" href="/dashboard/billing">Plan & usage →</Link>
        </div>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Requests scanned" value={total} icon={ScanLine} />
        <StatCard label="Blocked requests" value={blocked} icon={Ban} />
        <StatCard label="PII redactions" value={piiRedactions} icon={UserRoundX} />
        <StatCard label="Secrets prevented" value={secrets} icon={DatabaseZap} />
        <StatCard label="Average risk score" value={Math.round(aggregate._avg.riskScore ?? 0)} icon={Gauge} />
        <StatCard label="Top risk type" value={riskData[0]?.label.replaceAll("_", " ") ?? "LOW RISK"} icon={ShieldCheck} />
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          <h2 className="mb-4 text-lg font-semibold">Recent guard logs</h2>
          <LogsTable logs={logs} />
        </div>
        <div className="space-y-6">
          <UsageCard plan={project.plan} used={usage.used} limit={usage.limit} warning={usage.warning} exceeded={usage.exceeded} />
          <RiskChart data={riskData} />
        </div>
      </div>
    </div>
  );
}
