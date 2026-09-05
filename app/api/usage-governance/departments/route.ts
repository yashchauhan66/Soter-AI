import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiResponse";
import { requireOrganizationAccess } from "@/lib/auth/guards";
import { addDepartment } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const organizationId = String(formData.get("organizationId") ?? "");
    await requireOrganizationAccess(organizationId);

    await addDepartment(organizationId, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      defaultAction: String(formData.get("defaultAction") ?? "MONITOR_ONLY") as any,
    });

    return NextResponse.redirect(new URL("/dashboard/usage-governance/departments", request.url));
  } catch (error) {
    // apiError maps AuthError -> 401/403; a hardcoded 500 reported a tenant
    // boundary refusal as a server fault.
    return apiError(error, "Failed to add department.");
  }
}
