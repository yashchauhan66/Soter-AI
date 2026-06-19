import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueBackgroundJob, jobAcceptedResponse } from "@/lib/backgroundJobs";
import { checkRedisRateLimit } from "@/lib/rateLimit";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  organizationId: z.string().min(1),
  kind: z.enum(["GUARD_LOGS", "WEBHOOK_DELIVERIES"]).default("GUARD_LOGS"),
  format: z.enum(["JSONL", "CSV"]).default("JSONL"),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  projectId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = schema.parse(params);
    const access = await requirePermission(parsed.organizationId, "reports:export");
    const rate = await checkRedisRateLimit(`exports:${access.org.id}:${access.user.id}`, 10, 60_000);
    if (!rate.allowed) return jsonResponse({ error: "Rate limit exceeded.", resetAt: rate.resetAt }, { status: 429 });

    const fetchOptions = {
      organizationId: access.org.id,
      fromDate: parsed.fromDate ? new Date(parsed.fromDate) : null,
      toDate: parsed.toDate ? new Date(parsed.toDate) : null,
      projectId: parsed.projectId ?? null,
    };

    const exportRecord = await db.auditExport.create({
      data: {
        organizationId: access.org.id,
        requestedById: access.user.id,
        kind: parsed.kind,
        format: parsed.format,
        filterFromDate: fetchOptions.fromDate,
        filterToDate: fetchOptions.toDate,
        filterProjectId: fetchOptions.projectId,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const job = await enqueueBackgroundJob({
      type: "AUDIT_EXPORT",
      dedupeKey: `audit-export:${exportRecord.id}`,
      payload: {
        exportId: exportRecord.id,
        organizationId: access.org.id,
        kind: parsed.kind,
        format: parsed.format,
        fromDate: fetchOptions.fromDate?.toISOString() ?? null,
        toDate: fetchOptions.toDate?.toISOString() ?? null,
        projectId: fetchOptions.projectId,
      },
    });
    return jsonResponse(jobAcceptedResponse(job, { exportId: exportRecord.id }), { status: 202 });
  } catch (error) {
    return apiError(error, "Audit export failed.");
  }
}
