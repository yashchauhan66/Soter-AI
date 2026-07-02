import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { createEnrollmentToken } from "@/lib/extension/enrollment";

export const dynamic = "force-dynamic";

const createTokenSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  employeeEmail: z.string().trim().email().max(320).optional(),
  department: z.string().trim().max(200).optional(),
  role: z.string().trim().max(200).optional(),
  maxUses: z.number().int().min(1).max(1000).default(1),
  expiresInDays: z.number().int().min(1).max(365).default(30),
  expiresInHours: z.number().int().min(1).max(8760).optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = createTokenSchema.parse(await readJson(request));
    const organization = await db.organization.findUnique({ where: { id: body.organizationId }, select: { id: true } });
    if (!organization) return jsonResponse({ error: true, message: "Organization not found." }, { status: 404 });
    const expiresAt = new Date(Date.now() + (body.expiresInHours ? body.expiresInHours * 3_600_000 : body.expiresInDays * 86_400_000));
    const { rawToken, token } = await createEnrollmentToken({ ...body, createdByAdminId: admin.id, expiresAt });
    // The raw value is returned exactly once and is never persisted or logged.
    return jsonResponse({
      ok: true,
      rawToken,
      enrollmentCode: rawToken,
      token: {
        ...token,
        expiresAt: token.expiresAt.toISOString(),
        createdAt: token.createdAt.toISOString(),
        revokedAt: null,
        lastUsedAt: null,
        status: "active",
        createdByAdminId: admin.id,
        createdBy: admin.email ?? admin.name ?? admin.id,
      },
    }, { status: 201 });
  } catch (error) {
    return apiError(error, "Extension enrollment token could not be created.");
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const searchParams = new URL(request.url).searchParams;
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
        id: true, organizationId: true, employeeEmail: true, department: true, role: true, maxUses: true, usedCount: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true, createdByAdminId: true,
        createdByAdmin: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const now = Date.now();
    const withStatus = tokens.map((token) => ({
      ...token,
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
    return apiError(error, "Extension enrollment tokens could not be loaded.");
  }
}
