import { NextResponse } from "next/server";
import { removeDataClassification } from "@/lib/usage-governance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const id = String(formData.get("id") ?? "");
    await removeDataClassification(id);
    return NextResponse.redirect(new URL("/dashboard/usage-governance/data-classification", request.url));
  } catch (error) {
    console.error("[SoterAI] Governance data classification delete error:", error);
    return NextResponse.json({ error: true, message: "Failed to delete classification." }, { status: 500 });
  }
}
