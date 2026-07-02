import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const events = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "employeeId", "destinationDomain", "sourceApp", "fileNameHash", "originalExtension",
             "mimeType", "sizeBytes", "scannedBytes", "supported", "encryptedOrBinary", "detectedDataTypes",
             "fingerprintSetId", "riskScore", "severity", "actionTaken", "redactedPreview", "createdAt"
      FROM "AIFileScanEvent"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "createdAt" DESC
      LIMIT 500
    `;
    return jsonResponse({ events });
  } catch (error) {
    return apiError(error, "File scan events could not be loaded.");
  }
}
