import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  domain: z.string().trim().min(1).max(300),
  action: z.enum(["approve", "block", "classify_public_ai", "classify_enterprise_ai", "classify_browser_coding", "ignore"]),
  destinationName: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = actionSchema.parse(await readJson(request));

    let category: string;
    let enabled: boolean;
    let riskLevel: string;
    let name: string;

    switch (body.action) {
      case "approve":
        category = "public_ai";
        enabled = true;
        riskLevel = "low";
        name = body.destinationName ?? body.domain;
        break;
      case "block":
        category = "custom";
        enabled = false;
        riskLevel = "high";
        name = body.destinationName ?? body.domain;
        break;
      case "classify_public_ai":
        category = "public_ai";
        enabled = true;
        riskLevel = "medium";
        name = body.destinationName ?? body.domain;
        break;
      case "classify_enterprise_ai":
        category = "custom";
        enabled = true;
        riskLevel = "low";
        name = body.destinationName ?? body.domain;
        break;
      case "classify_browser_coding":
        category = "browser_coding";
        enabled = true;
        riskLevel = "medium";
        name = body.destinationName ?? body.domain;
        break;
      case "ignore":
        category = "custom";
        enabled = true;
        riskLevel = "low";
        name = body.destinationName ?? body.domain;
        break;
    }

    const destinationId = body.domain.replace(/[^a-z0-9]/g, "-").toLowerCase().slice(0, 80);

    // Upsert the AI destination
    await db.aIDestination.upsert({
      where: { organizationId_destinationId: { organizationId: body.organizationId, destinationId } },
      update: { category, enabled, riskLevel: riskLevel, name },
      create: {
        organizationId: body.organizationId,
        destinationId,
        name,
        category,
        domains: [body.domain],
        urlPatterns: [],
        enabled,
        riskLevel,
        allowedDepartments: ["all"],
        allowedRoles: ["all"],
        policyOverrides: {},
        responseScanningEnabled: true,
        loggingMode: "metadata_only",
      },
    });

    // Audit
    await db.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        organizationId: body.organizationId,
        action: `shadow_ai_destination_${body.action}`,
        targetType: "ai_destination",
        targetId: destinationId,
        reason: `Admin ${body.action}ed destination: ${body.domain}`,
        metadata: { domain: body.domain, action: body.action, category, riskLevel },
      },
    });

    return jsonResponse({ ok: true, destinationId, action: body.action });
  } catch (error) {
    return apiError(error, "Shadow AI destination action could not be completed.");
  }
}
