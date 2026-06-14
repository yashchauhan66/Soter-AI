import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { ReportActions } from "@/components/dashboard/ReportActions";
import Link from "next/link";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScheduledReportManager } from "@/components/dashboard/ScheduledReportManager";
import { enqueueBackgroundJob } from "@/lib/backgroundJobs";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  const now = new Date();
  const monthNumber = now.getUTCMonth() + 1;
  const yearNumber = now.getUTCFullYear();
  const report = await db.report.findUnique({
    where: { projectId_month_year: { projectId: project.id, month: monthNumber, year: yearNumber } },
  });
  if (!report) {
    await enqueueBackgroundJob({
      type: "MONTHLY_REPORT",
      dedupeKey: `monthly-report:${project.id}:${yearNumber}:${monthNumber}`,
      payload: { projectId: project.id, month: monthNumber, year: yearNumber },
    });
  }
  const schedule = await db.scheduledReport.findUnique({ where: { projectId_frequency: { projectId: project.id, frequency: "MONTHLY" } } });
  const month = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(report?.year ?? yearNumber, (report?.month ?? monthNumber) - 1, 1)),
  );
  const metrics = report ?? { totalRequests: 0, blockedRequests: 0, redactedRequests: 0, avgRiskScore: 0, topRiskTypes: [], recommendations: [] };
  const topRiskTypes = Array.isArray(metrics.topRiskTypes) ? metrics.topRiskTypes as Array<{ type: string; count: number }> : [];
  const recommendations = Array.isArray(metrics.recommendations) ? metrics.recommendations as string[] : [];
  const mostCommonRisk = topRiskTypes[0]?.type ?? (report ? "No material risks detected" : "Report generation queued");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Monthly posture</p>
          <h1 className="mt-2 text-3xl font-bold">{month} report</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <ReportActions />
          <ProjectSwitcher projects={projects} selectedId={project.id} />
          <Link href={`/dashboard/reports/white-label?project=${project.id}`} className="button-secondary !py-2 text-sm">White-label view</Link>
        </div>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total requests", metrics.totalRequests],
          ["Blocked", metrics.blockedRequests],
          ["Redacted", metrics.redactedRequests],
          ["Average risk", metrics.avgRiskScore],
        ].map(([label, value]) => (
          <div className="card p-5" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Risk summary</h2>
          <p className="mt-3 text-sm text-slate-500">
            Most common: <span className="text-slate-200">{mostCommonRisk.replaceAll("_", " ")}</span>
          </p>
          <div className="mt-5 space-y-3">
            {topRiskTypes.length ? topRiskTypes.map((item) => (
              <div className="flex justify-between rounded-xl bg-slate-950/60 p-3 text-sm" key={item.type}>
                <span>{item.type.replaceAll("_", " ")}</span>
                <span className="text-cyan">{item.count}</span>
              </div>
            )) : <p className="text-sm text-slate-500">No material risks recorded this month.</p>}
          </div>
        </section>
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Recommendations</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
            {(recommendations.length ? recommendations : ["Report generation is queued. Refresh after the background worker completes it."]).map((recommendation) => (
              <li key={recommendation} className="rounded-xl bg-slate-950/60 p-3">{recommendation}</li>
            ))}
          </ul>
        </section>
      </div>
      <section className="card mt-6 p-6">
        <h2 className="font-semibold">OWASP LLM Top 10 alignment</h2>
        <p className="mt-3 leading-7 text-slate-400">
          Phase 1 supports risk reduction for prompt injection, sensitive information disclosure,
          improper output handling, and unbounded consumption in chatbot input/output flows.
          Alignment does not represent certification or complete coverage.
        </p>
      </section>
      <ScheduledReportManager projectId={project.id} schedule={schedule} />
    </div>
  );
}
