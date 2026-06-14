import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { generateScimToken } from "@/lib/enterprise/scim";

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId is required." }, { status: 400 });
    await requirePermission(organizationId, "member:manage");
    const tokens = await db.scimToken.findMany({
      where: { organizationId },
      select: { id: true, name: true, tokenPreview: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return jsonResponse(tokens);
  } catch (error) {
    return apiError(error, "SCIM tokens could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const body = z.object({ organizationId: z.string().min(1), name: z.string().min(1).max(100), expiresAt: z.string().datetime().optional() }).parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "member:manage");
    const token = generateScimToken();
    const record = await db.scimToken.create({
      data: {
        organizationId: body.organizationId,
        name: body.name,
        tokenHash: token.tokenHash,
        tokenPreview: token.tokenPreview,
        createdById: access.user.id,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    await db.organizationAuditLog.create({
      data: {
        organizationId: body.organizationId,
        actorUserId: access.user.id,
        action: "scim_token_created",
        category: "scim",
        metadata: { tokenId: record.id, tokenPreview: record.tokenPreview, expiresAt: record.expiresAt },
      },
    });
    return jsonResponse({ id: record.id, token: token.rawToken, preview: record.tokenPreview }, { status: 201 });
  } catch (error) {
    return apiError(error, "SCIM token could not be generated.");
  }
}

export async function DELETE(request: Request) {
  try {
    const body = z.object({ organizationId: z.string().min(1), tokenId: z.string().min(1) }).parse(await readJson(request));
    const access = await requirePermission(body.organizationId, "member:manage");
    const token = await db.scimToken.findFirst({ where: { id: body.tokenId, organizationId: body.organizationId } });
    if (!token) return jsonResponse({ error: true, message: "SCIM token not found." }, { status: 404 });
    await db.scimToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
    await db.organizationAuditLog.create({
      data: {
        organizationId: body.organizationId,
        actorUserId: access.user.id,
        action: "scim_token_revoked",
        category: "scim",
        metadata: { tokenId: token.id, tokenPreview: token.tokenPreview },
      },
    });
    return jsonResponse({ id: token.id, revoked: true });
  } catch (error) {
    return apiError(error, "SCIM token could not be revoked.");
  }
}
