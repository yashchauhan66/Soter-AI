import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { reviewApprovalRequest } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const requestId = String(formData.get("requestId") ?? "");
    const status = String(formData.get("status") ?? "APPROVED") as "APPROVED" | "DENIED";
    const decisionReason = String(formData.get("decisionReason") ?? "") || undefined;

    await reviewApprovalRequest(requestId, user.id, status, decisionReason);

    return NextResponse.redirect(new URL("/dashboard/usage-governance/approvals", request.url));
  } catch (error) {
    console.error("[SoterAI] Governance approval review error:", error);
    return NextResponse.json({ error: true, message: "Failed to review approval request." }, { status: 500 });
  }
}
