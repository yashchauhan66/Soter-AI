import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiResponse";
import { requireOrganizationAccess } from "@/lib/auth/guards";
import { addDataClassification } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const organizationId = String(formData.get("organizationId") ?? "");
    await requireOrganizationAccess(organizationId);

    const allowedActionsStr = String(formData.get("allowedActions") ?? "ALLOW");
    const allowedActions = allowedActionsStr.split(",").filter(Boolean).map((a) => a.trim());

    await addDataClassification(organizationId, {
      sensitivityLevel: String(formData.get("sensitivityLevel") ?? "INTERNAL") as any,
      providerName: String(formData.get("providerName") ?? ""),
      allowedActions: allowedActions as any,
      requiresApproval: formData.get("requiresApproval") === "true",
    });

    return NextResponse.redirect(new URL("/dashboard/usage-governance/data-classification", request.url));
  } catch (error) {
    // apiError maps AuthError -> 401/403; a hardcoded 500 reported a tenant
    // boundary refusal as a server fault.
    return apiError(error, "Failed to add data classification.");
  }
}
