import { NextResponse } from "next/server";
import { addDepartmentRule } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const departmentId = String(formData.get("departmentId") ?? "");

    await addDepartmentRule(departmentId, {
      providerName: String(formData.get("providerName") ?? ""),
      modelPattern: String(formData.get("modelPattern") ?? "") || undefined,
      action: String(formData.get("action") ?? "MONITOR_ONLY") as any,
    });

    return NextResponse.redirect(new URL("/dashboard/usage-governance/departments", request.url));
  } catch (error) {
    console.error("[SoterAI] Governance department rule add error:", error);
    return NextResponse.json({ error: true, message: "Failed to add department rule." }, { status: 500 });
  }
}
