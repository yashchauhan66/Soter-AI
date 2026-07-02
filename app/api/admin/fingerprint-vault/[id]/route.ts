import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const { id } = await params;
    const rows = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "name", "description", "category"::text, "sensitivity"::text, "ownerDepartment", "action"::text,
             "enabled", "storageMode"::text, "sourceType"::text, "originalFileName", "mimeType", "sizeBytes",
             "retentionDays", "createdAt", "updatedAt", "lastMatchedAt"
      FROM "CompanyFingerprintSet"
      WHERE "id" = ${id} AND "organizationId" = ${organizationId} AND "deletedAt" IS NULL
      LIMIT 1
    `;
    if (!rows[0]) return jsonResponse({ error: true, message: "Fingerprint set not found." }, { status: 404 });
    return jsonResponse({ fingerprintSet: rows[0] });
  } catch (error) {
    return apiError(error, "Fingerprint set could not be loaded.");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const body = await readJson(request) as { organizationId?: string; enabled?: boolean; action?: string; retentionDays?: number };
    if (!body.organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const { id } = await params;
    await db.$executeRaw`
      UPDATE "CompanyFingerprintSet"
      SET "enabled" = COALESCE(${body.enabled ?? null}, "enabled"),
          "action" = COALESCE(${body.action ?? null}::"CompanyFingerprintAction", "action"),
          "retentionDays" = COALESCE(${body.retentionDays ?? null}, "retentionDays"),
          "updatedAt" = NOW()
      WHERE "id" = ${id} AND "organizationId" = ${body.organizationId} AND "deletedAt" IS NULL
    `;
    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "Fingerprint set could not be updated.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const { id } = await params;
    await db.$executeRaw`UPDATE "CompanyFingerprintSet" SET "deletedAt" = NOW(), "enabled" = false, "updatedAt" = NOW() WHERE "id" = ${id} AND "organizationId" = ${organizationId}`;
    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "Fingerprint set could not be deleted.");
  }
}
