import { NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/guards";
import { updatePolicy } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const organizationId = String(formData.get("organizationId") ?? "");
    await requireOrganizationAccess(organizationId);

    await updatePolicy(organizationId, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      enabled: formData.get("enabled") === "on",
      defaultAction: String(formData.get("defaultAction") ?? "MONITOR_ONLY") as any,
      restrictedDataAction: String(formData.get("restrictedDataAction") ?? "BLOCK") as any,
      piiDataAction: String(formData.get("piiDataAction") ?? "BLOCK") as any,
      requireApprovalForNew: formData.get("requireApprovalForNew") === "on",
      notifyOnBlocked: formData.get("notifyOnBlocked") === "on",
      notifyOnApprovalRequest: formData.get("notifyOnApprovalRequest") === "on",
      employeeMonitoringEnabled: formData.get("employeeMonitoringEnabled") === "on",
      auditRetentionDays: Number(formData.get("auditRetentionDays") ?? 365),
    });

    return NextResponse.redirect(new URL("/dashboard/usage-governance", request.url));
  } catch (error) {
    console.error("[SoterAI] Governance policy update error:", error);
    return NextResponse.json({ error: true, message: "Failed to update policy." }, { status: 500 });
  }
}
