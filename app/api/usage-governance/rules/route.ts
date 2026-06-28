import { NextResponse } from "next/server";
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
    console.error("[SoterAI] Governance rule add error:", error);
    return NextResponse.json({ error: true, message: "Failed to add rule." }, { status: 500 });
  }
}
