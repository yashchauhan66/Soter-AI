import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

export async function POST(request: Request) {
  try {
    const rateLimited = await enforcePublicRateLimit({
      request,
      scope: "scanner-lead",
      limit: 5,
      windowMs: 60_000,
      message: "Too many attempts. Please try again later.",
    });
    if (rateLimited) return rateLimited;

    const { email } = await request.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    await db.contactLead.create({
      data: {
        name: "Scanner User",
        email,
        company: "Unknown",
        interest: "Scanner Lead",
        message: "Captured from the free AI Security Scanner tool.",
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scanner Lead Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
