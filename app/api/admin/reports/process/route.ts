import { apiError, jsonResponse } from "@/lib/apiResponse";
import { enqueueBackgroundJob } from "@/lib/backgroundJobs";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const expected = process.env.REPORT_WORKER_TOKEN ?? process.env.WEBHOOK_WORKER_TOKEN;
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!expected || provided !== expected) return jsonResponse({ error: true, message: "Forbidden." }, { status: 403 });
    const due = await db.scheduledReport.findMany({
      where: { enabled: true, nextRunAt: { lte: new Date() } },
      orderBy: { nextRunAt: "asc" },
      take: 25,
      select: { id: true },
    });
    const jobs = await Promise.all(due.map((schedule) => enqueueBackgroundJob({
      type: "SCHEDULED_REPORT_DELIVERY",
      dedupeKey: `scheduled-report:${schedule.id}:${new Date().toISOString().slice(0, 10)}`,
      payload: { scheduleId: schedule.id },
    })));
    return jsonResponse({ enqueued: jobs.length, jobIds: jobs.map((job) => job.id) }, { status: 202 });
  } catch (error) { return apiError(error, "Scheduled report worker failed."); }
}
