import { NextResponse } from "next/server";
import { removeProviderRule } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const ruleId = String(formData.get("ruleId") ?? "");
    await removeProviderRule(ruleId);
    return NextResponse.redirect(new URL("/dashboard/usage-governance/providers", request.url));
  } catch (error) {
    console.error("[SoterAI] Governance rule delete error:", error);
    return NextResponse.json({ error: true, message: "Failed to delete rule." }, { status: 500 });
  }
}
