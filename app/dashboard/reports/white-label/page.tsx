import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import dynamicImport from "next/dynamic";
import { getOrCreateAgency } from "@/lib/agency";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueBackgroundJob } from "@/lib/backgroundJobs";

export const dynamic = "force-dynamic";

const WhiteLabelReportPrint = dynamicImport(() => import("@/components/dashboard/WhiteLabelReportPrint").then((mod) => mod.WhiteLabelReportPrint));

export default async function WhiteLabelReportPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const [project, projects, agency] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
    getOrCreateAgency(),
  ]);
  const projectWithClient = await db.project.findUnique({
    where: { id: project.id },
    include: { client: { select: { name: true } } },
  });
  const branding = await db.brandingSettings.findUnique({ where: { agencyId: agency.id } });
  const month = Number(params.month ?? new Date().getUTCMonth() + 1);
  const year = Number(params.year ?? new Date().getUTCFullYear());
  const safeMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getUTCMonth() + 1;
  const safeYear = Number.isInteger(year) && year >= 2020 && year <= 2200 ? year : new Date().getUTCFullYear();
  const report = await db.report.findUnique({ where: { projectId_month_year: { projectId: project.id, month: safeMonth, year: safeYear } } });
  if (!report) {
    await enqueueBackgroundJob({
      type: "MONTHLY_REPORT",
      dedupeKey: `monthly-report:${project.id}:${safeYear}:${safeMonth}`,
      payload: { projectId: project.id, month: safeMonth, year: safeYear },
    });
  }
  const piiRedactions = await db.guardLog.count({
    where: {
      projectId: project.id,
      action: "ALLOW_WITH_REDACTION",
      OR: [{ riskTypes: { has: "PII_DETECTED" } }, { riskTypes: { has: "INDIA_PII_DETECTED" } }],
      createdAt: {
        gte: new Date(Date.UTC(safeYear, safeMonth - 1, 1)),
        lt: new Date(Date.UTC(safeYear, safeMonth, 1)),
      },
    },
  });
  const secretsBlocked = await db.guardLog.count({
    where: {
      projectId: project.id,
      riskTypes: { has: "SECRET_DETECTED" },
      createdAt: {
        gte: new Date(Date.UTC(safeYear, safeMonth - 1, 1)),
        lt: new Date(Date.UTC(safeYear, safeMonth, 1)),
      },
    },
  });
  const unsafeBlocked = await db.guardLog.count({
    where: {
      projectId: project.id,
      action: "BLOCK",
      riskTypes: { has: "UNSAFE_OUTPUT" },
      createdAt: {
        gte: new Date(Date.UTC(safeYear, safeMonth - 1, 1)),
        lt: new Date(Date.UTC(safeYear, safeMonth, 1)),
      },
    },
  });
  const topRiskTypes = report && Array.isArray(report.topRiskTypes) ? report.topRiskTypes as Array<{ type: string; count: number }> : [];
  const recommendations = report && Array.isArray(report.recommendations) ? report.recommendations as string[] : ["Report generation is queued. Refresh after the background worker completes it."];

  return (
    <div className="print:bg-white">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="eyebrow">White-label</p>
          <h1 className="mt-2 text-3xl font-bold">Branded monthly report</h1>
          <p className="mt-2 text-slate-400">Use the print action for an A4-friendly export. Configure branding under agency settings.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <WhiteLabelReportPrint
        agency={{
          name: branding?.agencyName ?? agency.name,
          logoUrl: branding?.logoUrl ?? null,
          contactEmail: branding?.contactEmail ?? agency.contactEmail ?? null,
          footer: branding?.reportFooter ?? null,
          brandColor: branding?.brandColor ?? "#31d7c8",
        }}
        project={{
          name: projectWithClient?.publicName ?? project.name,
          clientName: projectWithClient?.client?.name ?? null,
        }}
        period={{ month: safeMonth, year: safeYear }}
        metrics={{
          totalRequests: report?.totalRequests ?? 0,
          blockedRequests: report?.blockedRequests ?? 0,
          redactedRequests: report?.redactedRequests ?? 0,
          piiRedactions,
          secretsBlocked,
          unsafeBlocked,
          avgRiskScore: report?.avgRiskScore ?? 0,
        }}
        topRiskTypes={topRiskTypes}
        recommendations={recommendations}
      />
    </div>
  );
}
