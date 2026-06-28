import { NextResponse } from "next/server";
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
    console.error("[SoterAI] Governance department add error:", error);
    return NextResponse.json({ error: true, message: "Failed to add department." }, { status: 500 });
  }
}
