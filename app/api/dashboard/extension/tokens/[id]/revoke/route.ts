import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  reason: z.string().trim().max(500).optional().default("Revoked from dashboard"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = schema.parse(await readJson(request));
    const { user } = await requirePermission(body.organizationId, "policy:manage");
    const token = await db.extensionEnrollmentToken.findFirst({ where: { id, organizationId: body.organizationId } });
    if (!token) return jsonResponse({ error: true, message: "Enrollment code not found." }, { status: 404 });
    const revoked = await db.extensionEnrollmentToken.update({
      where: { id },
      data: { revokedAt: token.revokedAt ?? new Date() },
      select: { id: true, revokedAt: true },
    });
    await db.adminAuditLog.create({
      data: {
        adminUserId: user.id,
        organizationId: token.organizationId,
        action: "extension_enrollment_token_revoked",
        targetType: "extension_enrollment_token",
        targetId: id,
        reason: body.reason,
        metadata: { usedCount: token.usedCount, maxUses: token.maxUses, source: "dashboard" },
      },
    });
    return jsonResponse({ ok: true, id: revoked.id, revokedAt: revoked.revokedAt?.toISOString() ?? null });
  } catch (error) {
    return apiError(error, "Enrollment code could not be revoked.");
  }
}
