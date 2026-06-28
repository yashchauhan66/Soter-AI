import { NextResponse } from "next/server";
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
    console.error("[SoterAI] Governance report generation error:", error);
    return NextResponse.json({ error: true, message: "Failed to generate report." }, { status: 500 });
  }
}
