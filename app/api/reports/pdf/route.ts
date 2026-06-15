// SECURITY: PDF download endpoint.
// - Requires reports:export permission for the project.
// - Streams the PDF buffer; no body content is logged.

import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { enqueueBackgroundJob, jobAcceptedResponse } from "@/lib/backgroundJobs";
import { checkRedisRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectId = params.get("projectId");
    if (!projectId) return new Response("projectId required.", { status: 400 });
    const month = Number(params.get("month") ?? new Date().getUTCMonth() + 1);
    const year = Number(params.get("year") ?? new Date().getUTCFullYear());
    const access = await requireProjectPermission(projectId, "reports:export");
    const rate = await checkRedisRateLimit(`reports:pdf:${access.org.id}:${access.project.id}`, 12, 60_000);
    if (!rate.allowed) return jsonResponse({ error: "Rate limit exceeded.", resetAt: rate.resetAt }, { status: 429 });
    const job = await enqueueBackgroundJob({
      type: "PDF_REPORT",
      dedupeKey: `pdf-report:${access.project.id}:${year}:${month}`,
      payload: { projectId: access.project.id, month, year },
    });
    return jsonResponse(jobAcceptedResponse(job, { projectId: access.project.id, month, year }), { status: 202 });
  } catch (error) {
    return apiError(error, "PDF report could not be generated.");
  }
}
