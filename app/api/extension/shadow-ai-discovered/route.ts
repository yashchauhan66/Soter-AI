import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { authenticateExtensionRequest, recordExtensionSecurityEvent } from "../_shared";

const shadowAiDiscoveredSchema = z.object({
  organizationId: z.string().min(1),
  employeeId: z.string().min(1),
  domain: z.string().min(1).max(300),
  destination: z.string().min(1).max(300),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
  url: z.string().max(2000).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = shadowAiDiscoveredSchema.parse(await readJson(request));
    const auth = await authenticateExtensionRequest(request, body.organizationId);
    if (!auth.ok) return auth.response;

    // Persist the shadow AI discovery as a security event
    await recordExtensionSecurityEvent({
      organizationId: body.organizationId,
      eventType: "EXTENSION_SHADOW_AI_DISCOVERED",
      severity: body.riskLevel === "high" ? "high" : body.riskLevel === "medium" ? "medium" : "low",
      action: "log_only",
      source: "extension",
      riskTypes: ["shadow_ai"],
      metadata: {
        domain: body.domain,
        destination: body.destination,
        riskLevel: body.riskLevel,
        employeeId: body.employeeId,
        url: body.url ?? null,
        source: "extension_content_script",
      },
    });

    // Upsert into AiProvider table for the dashboard
    await db.$executeRaw`
      INSERT INTO "AiProvider" ("id", "organizationId", "name", "providerType", "status", "riskLevel", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${body.organizationId}, ${body.destination}, 'shadow_ai', 'REVIEW', ${body.riskLevel.toUpperCase()}, NOW(), NOW())
      ON CONFLICT ("organizationId", "name") DO UPDATE
      SET "riskLevel" = ${body.riskLevel.toUpperCase()}, "updatedAt" = NOW()
    `;

    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "Shadow AI discovery could not be recorded.");
  }
}
