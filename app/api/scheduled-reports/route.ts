import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { nextMonthlyRun } from "@/lib/reports/scheduled";
import { enqueueBackgroundJob, jobAcceptedResponse } from "@/lib/backgroundJobs";

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) return jsonResponse({ error: true, message: "projectId required." }, { status: 400 });
    await requireProjectPermission(projectId, "reports:read");
    return jsonResponse(await db.scheduledReport.findMany({ where: { projectId }, include: { deliveries: { orderBy: { createdAt: "desc" }, take: 10 } } }));
  } catch (error) { return apiError(error, "Scheduled reports could not be loaded."); }
}

export async function PUT(request: Request) {
  try {
    const body = z.object({ projectId: z.string().min(1), recipients: z.array(z.string().email()).min(1).max(20), enabled: z.boolean().default(true), attachAuditSummary: z.boolean().default(false) }).parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "scheduled_report:manage");
    const report = await db.scheduledReport.upsert({ where: { projectId_frequency: { projectId: body.projectId, frequency: "MONTHLY" } }, create: { organizationId: access.org.id, projectId: body.projectId, recipients: body.recipients, enabled: body.enabled, attachAuditSummary: body.attachAuditSummary, nextRunAt: nextMonthlyRun() }, update: { recipients: body.recipients, enabled: body.enabled, attachAuditSummary: body.attachAuditSummary } });
    return jsonResponse(report);
  } catch (error) { return apiError(error, "Scheduled report could not be saved."); }
}

export async function POST(request: Request) {
  try {
    const { id } = z.object({ id: z.string().min(1) }).parse(await readJson(request));
    const schedule = await db.scheduledReport.findUnique({ where: { id } });
    if (!schedule) return jsonResponse({ error: true, message: "Schedule not found." }, { status: 404 });
    await requireProjectPermission(schedule.projectId, "scheduled_report:manage");
    const job = await enqueueBackgroundJob({
      type: "SCHEDULED_REPORT_DELIVERY",
      dedupeKey: `scheduled-report:${id}:${Date.now()}`,
      payload: { scheduleId: id },
    });
    return jsonResponse(jobAcceptedResponse(job, { scheduleId: id }), { status: 202 });
  } catch (error) { return apiError(error, "Scheduled report send failed."); }
}
