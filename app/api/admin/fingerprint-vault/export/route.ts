import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/ai-data-security/csv";

export const dynamic = "force-dynamic";

/** Redacted CSV export of fingerprint sets (metadata + hash counts only, never raw text). */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const sets = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s."name", s."category"::text AS category, s."sensitivity"::text AS sensitivity, s."ownerDepartment",
             s."action"::text AS action, s."enabled", s."storageMode"::text AS "storageMode", s."lastMatchedAt", s."createdAt",
             COUNT(c."id")::int AS "fingerprintCount"
      FROM "CompanyFingerprintSet" s
      LEFT JOIN "CompanyFingerprintChunk" c ON c."fingerprintSetId" = s."id"
      WHERE s."organizationId" = ${organizationId} AND s."deletedAt" IS NULL
      GROUP BY s."id"
      ORDER BY s."createdAt" DESC
      LIMIT 2000
    `;
    const csv = toCsv(
      ["name", "category", "sensitivity", "department", "action", "enabled", "storageMode", "hashCount", "lastMatchedAt", "createdAt"],
      sets.map((s) => [s.name, s.category, s.sensitivity, s.ownerDepartment, s.action, s.enabled, s.storageMode, s.fingerprintCount, s.lastMatchedAt, s.createdAt]),
    );
    return csvResponse("fingerprint-sets.csv", csv);
  } catch (error) {
    return apiError(error, "Fingerprint vault export failed.");
  }
}
