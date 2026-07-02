import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateExtensionRequest, recordExtensionSecurityEvent } from "../_shared";
import { rejectDisallowedRawContent, sanitizeExtensionPreview } from "@/lib/extension/privacyGuard";

export const dynamic = "force-dynamic";

const approvalSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  employeeId: z.string().trim().max(200).optional(),
  url: z.string().trim().max(2000),
  justification: z.string().trim().max(1000).optional(),
  riskScore: z.number().min(0).max(100),
  detectedDataTypes: z.array(z.string().trim().min(1).max(120)).max(50),
  redactedPreview: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await readJson(request);
    rejectDisallowedRawContent(raw);
    const body = approvalSchema.parse(raw);
    const auth = await authenticateExtensionRequest(request, body.organizationId);
    if (!auth.ok) return auth.response;
    const approvalId = `ext_appr_${crypto.randomUUID()}`;
    await recordExtensionSecurityEvent({
      organizationId: body.organizationId,
      projectId: "projectId" in auth ? auth.projectId : undefined,
      eventType: "EXTENSION_APPROVAL_REQUEST",
      severity: body.riskScore >= 85 ? "critical" : "high",
      action: "require_approval",
      source: "browser_extension",
      riskTypes: body.detectedDataTypes,
      metadata: {
        approvalId,
        employeeId: body.employeeId,
        domain: safeDomain(body.url),
        justification: body.justification,
        riskScore: body.riskScore,
        detectedDataTypes: body.detectedDataTypes,
        redactedPreview: sanitizeExtensionPreview(body.redactedPreview, "approval", body.detectedDataTypes),
        status: "PENDING",
      },
    });
    return jsonResponse({ approvalId, status: "PENDING", message: "Approval request recorded." }, { status: 201 });
  } catch (error) {
    return apiError(error, "Extension approval request could not be recorded.");
  }
}

function safeDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
