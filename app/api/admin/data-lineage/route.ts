import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const events = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "employeeId", "sourceDomain", "sourceApp", "sourceCategory", "sourceUrlHash",
             "destinationDomain", "destinationApp", "destinationCategory", "dataTypes", "riskScore",
             "severity", "actionTaken", "fingerprintSetId", "approvalRequestId", "redactedPreview",
             "eventType"::text, "createdAt"
      FROM "DataLineageEvent"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "createdAt" DESC
      LIMIT 500
    `;
    return jsonResponse({ events });
  } catch (error) {
    return apiError(error, "Data lineage events could not be loaded.");
  }
}
