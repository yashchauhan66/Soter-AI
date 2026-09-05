import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiResponse";
import { requireOrganizationAccess } from "@/lib/auth/guards";
import { generateGovernanceReport } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const organizationId = String(formData.get("organizationId") ?? "");
    await requireOrganizationAccess(organizationId);

    const period = String(formData.get("period") ?? "MONTHLY") as "WEEKLY" | "MONTHLY" | "QUARTERLY";
    await generateGovernanceReport(organizationId, period);

    return NextResponse.redirect(new URL("/dashboard/usage-governance/reports", request.url));
  } catch (error) {
    // apiError maps AuthError -> 401/403; a hardcoded 500 reported a tenant
    // boundary refusal as a server fault.
    return apiError(error, "Failed to generate report.");
  }
}
