import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiResponse";
import { requireOrganizationAccess } from "@/lib/auth/guards";
import { addProviderRule } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const organizationId = String(formData.get("organizationId") ?? "");
    await requireOrganizationAccess(organizationId);

    await addProviderRule(organizationId, {
      providerName: String(formData.get("providerName") ?? ""),
      modelPattern: String(formData.get("modelPattern") ?? "") || undefined,
      action: String(formData.get("action") ?? "MONITOR_ONLY") as any,
      reason: String(formData.get("reason") ?? "") || undefined,
    });

    return NextResponse.redirect(new URL("/dashboard/usage-governance/providers", request.url));
  } catch (error) {
    // apiError maps AuthError -> 401/403; a hardcoded 500 reported a tenant
    // boundary refusal as a server fault.
    return apiError(error, "Failed to add rule.");
  }
}
