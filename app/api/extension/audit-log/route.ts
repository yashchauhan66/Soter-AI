import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateExtensionRequest, extensionActionSchema, extensionSeveritySchema, recordExtensionSecurityEvent } from "../_shared";
import { rejectDisallowedRawContent, sanitizeExtensionPreview } from "@/lib/extension/privacyGuard";

export const dynamic = "force-dynamic";

const auditSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  employeeId: z.string().trim().max(200).optional(),
  extensionVersion: z.string().trim().min(1).max(40),
  browser: z.enum(["chrome", "edge", "unknown"]),
  domain: z.string().trim().min(1).max(300),
  url: z.string().trim().max(2000).optional(),
  policyVersion: z.string().trim().min(1).max(200),
  action: extensionActionSchema,
  severity: extensionSeveritySchema,
  riskScore: z.number().min(0).max(100),
  detectedDataTypes: z.array(z.string().trim().min(1).max(120)).max(50),
  matchedRules: z.array(z.string().trim().min(1).max(200)).max(50),
  redactedPreview: z.string().max(1000).optional(),
  eventType: z.enum(["scan", "submit", "paste", "context_menu", "heartbeat", "approval_request", "file_upload", "response"]),
  occurredAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await readJson(request);
    rejectDisallowedRawContent(raw);
    const body = auditSchema.parse(raw);
    const auth = await authenticateExtensionRequest(request, body.organizationId);
    if (!auth.ok) return auth.response;
    const event = await recordExtensionSecurityEvent({
      organizationId: body.organizationId,
      projectId: "projectId" in auth ? auth.projectId : undefined,
      eventType: `EXTENSION_${body.eventType.toUpperCase()}`,
      severity: body.severity,
      action: body.action,
      source: "browser_extension",
      riskTypes: body.detectedDataTypes,
      metadata: {
        employeeId: body.employeeId,
        extensionVersion: body.extensionVersion,
        browser: body.browser,
        domain: body.domain,
        policyVersion: body.policyVersion,
        riskScore: body.riskScore,
        matchedRules: body.matchedRules,
        redactedPreview: sanitizeExtensionPreview(body.redactedPreview, body.eventType === "response" ? "response" : "prompt", body.detectedDataTypes),
        occurredAt: body.occurredAt,
        metadata: body.metadata ?? {},
      },
    });
    return jsonResponse({ ok: true, auditId: event?.id ?? null }, { status: 201 });
  } catch (error) {
    return apiError(error, "Extension audit event could not be recorded.");
  }
}
