import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const searchParams = new URL(request.url).searchParams;
    const organizationId = searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });

    const status = searchParams.get("status");
    const department = searchParams.get("department");
    const role = searchParams.get("role");
    const createdBy = searchParams.get("createdBy");
    const tokens = await db.extensionEnrollmentToken.findMany({
      where: {
        organizationId,
        ...(department ? { department } : {}),
        ...(role ? { role } : {}),
        ...(createdBy ? { createdByAdminId: createdBy } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        employeeEmail: true,
        department: true,
        role: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        revokedAt: true,
        lastUsedAt: true,
        createdAt: true,
        createdByAdminId: true,
        createdByAdmin: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = Date.now();
    const withStatus = tokens.map((token) => ({
      id: token.id,
      organizationId: token.organizationId,
      employeeEmail: token.employeeEmail,
      department: token.department,
      role: token.role,
      maxUses: token.maxUses,
      usedCount: token.usedCount,
      expiresAt: token.expiresAt.toISOString(),
      revokedAt: token.revokedAt?.toISOString() ?? null,
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
      createdByAdminId: token.createdByAdminId,
      createdBy: token.createdByAdmin?.email ?? token.createdByAdmin?.name ?? token.createdByAdmin?.id ?? "Unknown admin",
      status: token.revokedAt ? "revoked" : token.expiresAt.getTime() <= now ? "expired" : token.usedCount >= token.maxUses ? "used_up" : "active",
    }));

    return jsonResponse({ tokens: status ? withStatus.filter((token) => token.status === status) : withStatus });
  } catch (error) {
    return apiError(error, "Extension enrollments could not be loaded.");
  }
}
