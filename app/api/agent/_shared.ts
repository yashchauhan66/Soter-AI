import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { agentIdentitySchema } from "@/lib/extension/agentIdentity";
import { listAIDestinations } from "@/lib/ai-destinations";
import { listPolicies } from "@/lib/admin-ai-policies/store";
import { compileExtensionPolicyBundle } from "@/lib/admin-ai-policies";
import { db } from "@/lib/db";
import { scanText } from "@/packages/detectors/src";
import { evaluatePolicy } from "@/packages/policy-engine/src";
import { matchAIDestination } from "@/packages/shared/src/ai-destinations";

export { agentIdentitySchema };

export async function loadAgentPolicy(organizationId: string) {
  const { defaultExtensionPolicy } = await import("@/app/api/extension/_shared");
  const fallback = defaultExtensionPolicy(organizationId);
  const [destinations, policies] = await Promise.all([
    listAIDestinations(organizationId, { enabledOnly: true }),
    listPolicies(organizationId),
  ]);
  const compiled = compileExtensionPolicyBundle(organizationId, policies);
  return {
    ...fallback,
    version: compiled.policies.length ? String(compiled.version) : fallback.version,
    destinations,
    ...(compiled.policies.length ? {
      defaultAction: compiled.defaultAction,
      customDetectors: compiled.customDetectors,
      rules: compiled.policies.map((policy) => ({
        id: policy.id, name: policy.name, action: policy.action, severity: policy.severity,
        destinations: policy.destinations, departments: policy.scope.departments,
        roles: policy.scope.roles, detectedDataTypes: policy.detectors, enabled: policy.enabled,
      })),
    } : {}),
  };
}

export async function upsertDeviceHeartbeat(input: z.infer<typeof agentIdentitySchema> & { policyVersion?: string; status?: string; activeDestination?: string }) {
  return db.deviceAgent.upsert({
    where: { organizationId_deviceId_type: { organizationId: input.organizationId, deviceId: input.deviceId, type: input.type } },
    create: { ...input, lastHeartbeatAt: new Date() },
    update: { employeeId: input.employeeId, version: input.version, platform: input.platform, policyVersion: input.policyVersion, status: input.status ?? "active", activeDestination: input.activeDestination, lastHeartbeatAt: new Date() },
  });
}

export async function authenticateAgentJson(request: Request, organizationId: string) {
  const { authenticateAgentRequest } = await import("@/app/api/extension/_shared");
  return authenticateAgentRequest(request, organizationId);
}

export async function recordExtensionSecurityEvent(...args: Parameters<typeof import("@/app/api/extension/_shared").recordExtensionSecurityEvent>) {
  const shared = await import("@/app/api/extension/_shared");
  return shared.recordExtensionSecurityEvent(...args);
}

export { apiError, jsonResponse, readJson, scanText, evaluatePolicy, matchAIDestination };
