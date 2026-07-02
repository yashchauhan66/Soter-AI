import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/ai-data-security/csv";

export const dynamic = "force-dynamic";

/** Redacted CSV export of file scan events. File names are exported as hashes; content is never stored. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const events = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "createdAt", "employeeId", "destinationDomain", "fileNameHash", "originalExtension", "mimeType",
             "sizeBytes", "scannedBytes", "supported", "detectedDataTypes", "riskScore", "severity", "actionTaken", "redactedPreview"
      FROM "AIFileScanEvent"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "createdAt" DESC
      LIMIT 5000
    `;
    const csv = toCsv(
      ["time", "employeeId", "destination", "fileNameHash", "extension", "mimeType", "sizeBytes", "scannedBytes", "supported", "dataTypes", "riskScore", "severity", "action", "redactedPreview"],
      events.map((e) => [e.createdAt, e.employeeId, e.destinationDomain, e.fileNameHash, e.originalExtension, e.mimeType, e.sizeBytes, e.scannedBytes, e.supported, e.detectedDataTypes, e.riskScore, e.severity, e.actionTaken, e.redactedPreview]),
    );
    return csvResponse("file-scan-events.csv", csv);
  } catch (error) {
    return apiError(error, "File scan events export failed.");
  }
}
