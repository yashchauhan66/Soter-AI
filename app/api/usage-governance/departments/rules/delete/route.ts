import { NextResponse } from "next/server";
import { removeDepartmentRule } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const ruleId = String(formData.get("ruleId") ?? "");
    await removeDepartmentRule(ruleId);
    return NextResponse.redirect(new URL("/dashboard/usage-governance/departments", request.url));
  } catch (error) {
    console.error("[SoterAI] Governance department rule delete error:", error);
    return NextResponse.json({ error: true, message: "Failed to delete department rule." }, { status: 500 });
  }
}
