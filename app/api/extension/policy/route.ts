import { apiError, jsonResponse } from "@/lib/apiResponse";
import { authenticateExtensionRequest, defaultExtensionPolicy } from "../_shared";
import { compileExtensionPolicyBundle } from "@/lib/admin-ai-policies";
import { listPolicies } from "@/lib/admin-ai-policies/store";
import { listAIDestinations } from "@/lib/ai-destinations";
import { applyEmergencyLockdown, getEmergencyLockdown } from "@/lib/extension/emergencyLockdown";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const auth = await authenticateExtensionRequest(request, organizationId);
    if (!auth.ok) return auth.response;
    const fallback = defaultExtensionPolicy(organizationId);
    try {
      const [policies, destinations, lockdownState] = await Promise.all([
        listPolicies(organizationId),
        listAIDestinations(organizationId, { enabledOnly: true }),
        getEmergencyLockdown(organizationId),
      ]);
      const fallbackWithLockdown = applyEmergencyLockdown({ ...fallback, destinations }, lockdownState);
      const emergencyLockdown = fallbackWithLockdown.emergencyLockdown!;
      const compiled = compileExtensionPolicyBundle(organizationId, policies);
      if (!compiled.policies.length) return jsonResponse(fallbackWithLockdown);
      return jsonResponse({
        ...fallbackWithLockdown,
        version: `${compiled.version}-emergency-${emergencyLockdown.policyVersion}`,
        publishedAt: compiled.publishedAt,
        defaultAction: compiled.defaultAction,
        policies: compiled.policies,
        customDetectors: compiled.customDetectors,
        destinations,
        emergencyLockdown,
        rules: compiled.policies.map((policy) => ({
          id: policy.id,
          name: policy.name,
          action: policy.action,
          severity: policy.severity,
          destinations: policy.destinations,
          departments: policy.scope.departments,
          roles: policy.scope.roles,
          detectedDataTypes: policy.detectors,
          enabled: policy.enabled,
        })),
      });
    } catch (error) {
      console.error("[Soter extension] Falling back to default policy bundle", error);
      // Do not silently erase an active lockdown if persistence is unavailable.
      // The extension keeps enforcing its last cached bundle until a complete bundle can be served.
      return jsonResponse({ error: true, message: "Extension policy is temporarily unavailable." }, { status: 503 });
    }
  } catch (error) {
    return apiError(error, "Extension policy could not be loaded.");
  }
}
