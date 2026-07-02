import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const revokeSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  tokenId: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = revokeSchema.parse(await readJson(request));

    const token = await db.extensionEnrollmentToken.findUnique({ where: { id: body.tokenId } });
    if (!token) return jsonResponse({ error: true, message: "Token not found." }, { status: 404 });
    if (token.organizationId !== body.organizationId) {
      return jsonResponse({ error: true, message: "Token does not belong to this organization." }, { status: 403 });
    }

    if (token.revokedAt) {
      return jsonResponse({ ok: true, message: "Token is already revoked." });
    }

    await db.extensionEnrollmentToken.update({
      where: { id: body.tokenId },
      data: { revokedAt: new Date() },
    });

    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: body.organizationId,
        action: "extension_enrollment_token_revoked",
        targetType: "extension_enrollment_token",
        targetId: body.tokenId,
        reason: "Admin revoked enrollment token",
        metadata: { employeeEmail: token.employeeEmail, department: token.department },
      },
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "Enrollment token could not be revoked.");
  }
}
