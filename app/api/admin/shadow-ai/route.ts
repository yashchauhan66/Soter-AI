import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const updateProviderSchema = z.object({
  providerId: z.string().min(1),
  action: z.enum(["approve", "block", "classify", "review", "reset"]),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  notes: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = updateProviderSchema.parse(await readJson(request));

    const provider = await db.aiProvider.findUnique({ where: { id: body.providerId } });
    if (!provider) {
      return jsonResponse({ error: true, message: "Provider not found." }, { status: 404 });
    }

    let newStatus = provider.status;
    switch (body.action) {
      case "approve":
        newStatus = "APPROVED";
        break;
      case "block":
        newStatus = "BLOCKED";
        break;
      case "classify":
        newStatus = body.riskLevel === "high" || body.riskLevel === "critical" ? "REVIEW" : "APPROVED";
        break;
      case "review":
        newStatus = "REVIEW";
        break;
      case "reset":
        newStatus = "REVIEW";
        break;
    }

    if (body.riskLevel) {
      await db.$executeRaw`
        UPDATE "AiProvider"
        SET "status" = ${newStatus}, "riskLevel" = ${body.riskLevel.toUpperCase()}, "updatedAt" = NOW()
        WHERE "id" = ${body.providerId}
      `;
    } else {
      await db.$executeRaw`
        UPDATE "AiProvider"
        SET "status" = ${newStatus}, "updatedAt" = NOW()
        WHERE "id" = ${body.providerId}
      `;
    }

    // Audit
    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: provider.organizationId,
        action: `shadow_ai_${body.action}`,
        targetType: "ai_provider",
        targetId: body.providerId,
        reason: body.notes ?? `Admin ${body.action}ed provider ${provider.name}`,
        metadata: { providerName: provider.name, newStatus, riskLevel: body.riskLevel ?? null },
      },
    });

    return jsonResponse({ ok: true, providerId: body.providerId, status: newStatus });
  } catch (error) {
    return apiError(error, "Shadow AI provider could not be updated.");
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    const where = organizationId ? { organizationId } : {};

    const [providers, models, scans] = await Promise.all([
      db.aiProvider.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.aiModel.findMany({
        where: organizationId ? { organizationId } : {},
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.shadowAiScan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { _count: { select: { findings: true } } },
      }),
    ]);

    return jsonResponse({ providers, models, scans });
  } catch (error) {
    return apiError(error, "Shadow AI data could not be loaded.");
  }
}
