import { apiError, jsonResponse } from "@/lib/apiResponse";
import { authenticateExtensionRequest } from "../_shared";
import { getEmergencyLockdown, lockdownPolicy } from "@/lib/extension/emergencyLockdown";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const auth = await authenticateExtensionRequest(request, organizationId);
    if (!auth.ok) return auth.response;

    const state = await getEmergencyLockdown(organizationId);
    const policy = lockdownPolicy(state);

    return jsonResponse({
      enabled: policy.enabled,
      policyVersion: policy.policyVersion,
      reason: policy.reason,
      enabledAt: policy.enabledAt,
      blockUnknownDestinations: policy.blockUnknownDestinations,
      blockAllFileUploads: policy.blockAllFileUploads,
      blockedDataTypes: policy.blockedDataTypes,
      requireApprovalDataTypes: policy.requireApprovalDataTypes,
      allowOnlyEnterpriseDestinations: policy.allowOnlyEnterpriseDestinations,
    });
  } catch (error) {
    return apiError(error, "Emergency lockdown state could not be loaded.");
  }
}
