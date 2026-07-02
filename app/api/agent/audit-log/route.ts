import { z } from "zod";
import { agentIdentitySchema, apiError, authenticateAgentJson, jsonResponse, readJson, recordExtensionSecurityEvent } from "../_shared";

const schema = agentIdentitySchema.extend({
  eventType: z.string().trim().min(1).max(100),
  action: z.enum(["allow", "log_only", "warn", "redact", "rewrite", "block", "require_justification", "require_approval"]),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  detectedDataTypes: z.array(z.string().max(120)).max(50).default([]),
  destinationId: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const auth = await authenticateAgentJson(request, body.organizationId);
    if (!auth.ok) return auth.response;
    const event = await recordExtensionSecurityEvent({
      organizationId: body.organizationId, eventType: `AGENT_${body.eventType.toUpperCase()}`,
      severity: body.severity, action: body.action, source: body.type,
      riskTypes: body.detectedDataTypes,
      metadata: { employeeId: body.employeeId, deviceId: body.deviceId, version: body.version, platform: body.platform, destinationId: body.destinationId, ...body.metadata },
    });
    return jsonResponse({ ok: true, auditId: event?.id ?? null }, { status: 201 });
  } catch (error) {
    return apiError(error, "Agent audit event could not be recorded.");
  }
}
