import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.string().trim().max(500).optional().default("Revoked by admin"),
  organizationId: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = schema.parse(await readJson(request));
    const token = await db.extensionEnrollmentToken.findUnique({ where: { id } });
    if (!token) return jsonResponse({ error: true, message: "Enrollment token not found." }, { status: 404 });
    if (body.organizationId && token.organizationId !== body.organizationId) {
      return jsonResponse({ error: true, message: "Enrollment token does not belong to this organization." }, { status: 403 });
    }
    const revoked = await db.extensionEnrollmentToken.update({
      where: { id },
      data: { revokedAt: token.revokedAt ?? new Date() },
      select: { id: true, organizationId: true, revokedAt: true },
    });
    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: token.organizationId,
        action: "extension_enrollment_token_revoked",
        targetType: "extension_enrollment_token",
        targetId: id,
        reason: body.reason,
        metadata: { usedCount: token.usedCount, maxUses: token.maxUses },
      },
    });
    return jsonResponse({ ok: true, token: { ...revoked, revokedAt: revoked.revokedAt?.toISOString() ?? null } });
  } catch (error) {
    return apiError(error, "Extension enrollment token could not be revoked.");
  }
}
