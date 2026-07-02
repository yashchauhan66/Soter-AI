import { z } from "zod";
import { agentIdentitySchema, apiError, authenticateAgentJson, evaluatePolicy, jsonResponse, loadAgentPolicy, matchAIDestination, readJson, scanText } from "../_shared";

const schema = agentIdentitySchema.pick({ organizationId: true, employeeId: true, deviceId: true }).extend({
  text: z.string().min(1).max(20000),
  url: z.string().url().max(2000),
  department: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  direction: z.enum(["request", "response"]).default("request"),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const auth = await authenticateAgentJson(request, body.organizationId);
    if (!auth.ok) return auth.response;
    const policy = await loadAgentPolicy(body.organizationId);
    const destination = matchAIDestination(body.url, policy.destinations ?? [], body.department, body.role);
    if (!destination) return jsonResponse({ error: true, message: "Destination is not enabled for this device scope." }, { status: 403 });
    const scan = scanText(body.text);
    const decision = evaluatePolicy({
      organizationId: body.organizationId, employeeId: body.employeeId ?? body.deviceId,
      department: body.department, role: body.role, destinationDomain: new URL(body.url).hostname,
      destinationType: destination.category, text: body.text, detectedDataTypes: scan.detectedDataTypes,
      riskScore: scan.riskScore, defaultOrgPolicy: policy,
    });
    return jsonResponse({
      allowed: !["block", "require_approval"].includes(decision.action),
      action: decision.action, riskScore: scan.riskScore, detectedDataTypes: scan.detectedDataTypes,
      redactedText: decision.redactedText, rewrittenSafeText: decision.rewrittenSafeText,
      destinationId: destination.destinationId, policyVersion: policy.version,
    });
  } catch (error) {
    return apiError(error, "Agent scan could not be completed.");
  }
}
