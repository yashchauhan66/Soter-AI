import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/ai-data-security/csv";

export const dynamic = "force-dynamic";

/** Redacted CSV export of lineage events. Source URLs are exported as hashes; no raw clipboard text. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const events = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "createdAt", "employeeId", "sourceApp", "sourceCategory", "sourceUrlHash", "destinationApp",
             "destinationCategory", "dataTypes", "riskScore", "severity", "actionTaken", "eventType"::text AS "eventType"
      FROM "DataLineageEvent"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "createdAt" DESC
      LIMIT 5000
    `;
    const csv = toCsv(
      ["time", "employeeId", "sourceApp", "sourceCategory", "sourceUrlHash", "destinationApp", "destinationCategory", "dataTypes", "riskScore", "severity", "action", "eventType"],
      events.map((e) => [e.createdAt, e.employeeId, e.sourceApp, e.sourceCategory, e.sourceUrlHash, e.destinationApp, e.destinationCategory, e.dataTypes, e.riskScore, e.severity, e.actionTaken, e.eventType]),
    );
    return csvResponse("data-lineage-events.csv", csv);
  } catch (error) {
    return apiError(error, "Data lineage export failed.");
  }
}
