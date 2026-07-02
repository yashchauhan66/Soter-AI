import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const { id } = await params;
    const matches = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "employeeId", "deviceId", "destinationDomain", "sourceApp", "matchType"::text,
             "similarityScore", "confidence"::text, "actionTaken", "redactedPreview", "createdAt"
      FROM "CompanyFingerprintMatch"
      WHERE "organizationId" = ${organizationId} AND "fingerprintSetId" = ${id}
      ORDER BY "createdAt" DESC
      LIMIT 200
    `;
    return jsonResponse({ matches });
  } catch (error) {
    return apiError(error, "Fingerprint matches could not be loaded.");
  }
}
