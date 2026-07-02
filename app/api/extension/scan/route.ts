import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateExtensionRequest, extensionActionSchema, recordExtensionSecurityEvent } from "../_shared";
import { rejectDisallowedRawContent, sanitizeExtensionPreview } from "@/lib/extension/privacyGuard";

export const dynamic = "force-dynamic";

const scanSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  employeeId: z.string().trim().max(200).optional(),
  url: z.string().trim().max(2000),
  riskScore: z.number().min(0).max(100),
  detectedDataTypes: z.array(z.string().trim().min(1).max(120)).max(50),
  action: extensionActionSchema,
  redactedPreview: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await readJson(request);
    rejectDisallowedRawContent(raw);
    const body = scanSchema.parse(raw);
    const auth = await authenticateExtensionRequest(request, body.organizationId);
    if (!auth.ok) return auth.response;
    const domain = safeDomain(body.url);
    const event = await recordExtensionSecurityEvent({
      organizationId: body.organizationId,
      projectId: "projectId" in auth ? auth.projectId : undefined,
      eventType: "EXTENSION_SCAN",
      severity: body.riskScore >= 85 ? "critical" : body.riskScore >= 60 ? "high" : body.riskScore >= 30 ? "medium" : "low",
      action: body.action,
      source: "browser_extension",
      riskTypes: body.detectedDataTypes,
      metadata: {
        employeeId: body.employeeId,
        domain,
        riskScore: body.riskScore,
        detectedDataTypes: body.detectedDataTypes,
        redactedPreview: sanitizeExtensionPreview(body.redactedPreview, "prompt", body.detectedDataTypes),
      },
    });
    return jsonResponse({ ok: true, scanId: event?.id ?? null });
  } catch (error) {
    return apiError(error, "Extension scan could not be recorded.");
  }
}

function safeDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
