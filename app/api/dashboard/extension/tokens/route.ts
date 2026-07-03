import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createEnrollmentToken } from "@/lib/extension/enrollment";

export const dynamic = "force-dynamic";

// User-facing counterpart of /api/admin/extension-enrollment-token, scoped to the
// caller's own organization via requirePermission (no platform-admin required).

const createTokenSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  employeeEmail: z.string().trim().email().max(320).optional(),
  department: z.string().trim().max(200).optional(),
  role: z.string().trim().max(200).optional(),
  maxUses: z.number().int().min(1).max(1000).default(1),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});

export async function POST(request: Request) {
  try {
    const body = createTokenSchema.parse(await readJson(request));
    const { user } = await requirePermission(body.organizationId, "policy:manage");
    const expiresAt = new Date(Date.now() + body.expiresInDays * 86_400_000);
    const { rawToken, token } = await createEnrollmentToken({
      organizationId: body.organizationId,
      createdByAdminId: user.id,
      employeeEmail: body.employeeEmail,
      department: body.department,
      role: body.role,
      maxUses: body.maxUses,
      expiresAt,
    });
    // The raw enrollment code is returned exactly once and is never persisted or logged.
    return jsonResponse(
      {
        ok: true,
        enrollmentCode: rawToken,
        token: {
          id: token.id,
          maxUses: token.maxUses,
          usedCount: token.usedCount,
          department: token.department,
          role: token.role,
          employeeEmail: token.employeeEmail,
          expiresAt: token.expiresAt.toISOString(),
          createdAt: token.createdAt.toISOString(),
          status: "active",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, "Enrollment code could not be created.");
  }
}

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    await requirePermission(organizationId, "policy:manage");
    const tokens = await db.extensionEnrollmentToken.findMany({
      where: { organizationId },
      select: {
        id: true, employeeEmail: true, department: true, role: true, maxUses: true,
        usedCount: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const now = Date.now();
    return jsonResponse({
      tokens: tokens.map((token) => ({
        ...token,
        expiresAt: token.expiresAt.toISOString(),
        revokedAt: token.revokedAt?.toISOString() ?? null,
        lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
        createdAt: token.createdAt.toISOString(),
        status: token.revokedAt
          ? "revoked"
          : token.expiresAt.getTime() <= now
            ? "expired"
            : token.usedCount >= token.maxUses
              ? "used_up"
              : "active",
      })),
    });
  } catch (error) {
    return apiError(error, "Enrollment codes could not be loaded.");
  }
}
