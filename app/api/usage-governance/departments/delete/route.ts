import { NextResponse } from "next/server";
import { removeDepartment } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const departmentId = String(formData.get("departmentId") ?? "");
    await removeDepartment(departmentId);
    return NextResponse.redirect(new URL("/dashboard/usage-governance/departments", request.url));
  } catch (error) {
    console.error("[SoterAI] Governance department delete error:", error);
    return NextResponse.json({ error: true, message: "Failed to delete department." }, { status: 500 });
  }
}
