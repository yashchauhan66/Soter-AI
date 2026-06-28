import { NextResponse } from "next/server";
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
    console.error("[SoterAI] Governance data classification add error:", error);
    return NextResponse.json({ error: true, message: "Failed to add data classification." }, { status: 500 });
  }
}
