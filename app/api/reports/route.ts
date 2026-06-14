import { apiError, jsonResponse } from "@/lib/apiResponse";
import { getCurrentProjectById } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueBackgroundJob, jobAcceptedResponse } from "@/lib/backgroundJobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const project = await getCurrentProjectById(params.get("projectId") ?? undefined);
    const access = await requireProjectPermission(project.id, "reports:read");
    const month = Number(params.get("month") ?? new Date().getUTCMonth() + 1);
    const year = Number(params.get("year") ?? new Date().getUTCFullYear());
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year > 2200) {
      return jsonResponse({ error: true, message: "Invalid report month or year." }, { status: 400 });
    }
    const cached = await db.report.findUnique({ where: { projectId_month_year: { projectId: project.id, month, year } } });
    if (cached) return jsonResponse(cached);
    const job = await enqueueBackgroundJob({
      type: "MONTHLY_REPORT",
      dedupeKey: `monthly-report:${project.id}:${year}:${month}`,
      payload: { projectId: project.id, month, year },
    });
    await db.onboardingProgress.upsert({
      where: { userId: access.user.id },
      create: { userId: access.user.id, reportGenerated: true },
      update: { reportGenerated: true },
    });
    return jsonResponse(jobAcceptedResponse(job, { projectId: project.id, month, year }), { status: 202 });
  } catch (error) { return apiError(error, "Monthly report could not be generated."); }
}
