import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const body = await readJson(request) as { organizationId?: string; enabled?: boolean; domains?: string[]; category?: string; sensitivity?: string };
    if (!body.organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const { id } = await params;
    await db.$executeRaw`
      UPDATE "SourceAppConfig"
      SET "enabled" = COALESCE(${body.enabled ?? null}, "enabled"),
          "domains" = COALESCE(${body.domains ?? null}, "domains"),
          "category" = COALESCE(${body.category ?? null}, "category"),
          "sensitivity" = COALESCE(${body.sensitivity ?? null}, "sensitivity"),
          "updatedAt" = NOW()
      WHERE "id" = ${id} AND "organizationId" = ${body.organizationId}
    `;
    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "Source app could not be updated.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const { id } = await params;
    await db.$executeRaw`DELETE FROM "SourceAppConfig" WHERE "id" = ${id} AND "organizationId" = ${organizationId}`;
    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "Source app could not be deleted.");
  }
}
