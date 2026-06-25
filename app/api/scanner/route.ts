import { NextResponse } from "next/server";
import { analyzeText } from "@/lib/guard/analyze";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

export async function POST(request: Request) {
  try {
    const rateLimited = await enforcePublicRateLimit({
      request,
      scope: "scanner-api",
      limit: 10,
      windowMs: 60_000,
      message: "Too many scans. Please try again later.",
    });
    if (rateLimited) return rateLimited;

    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
    }

    const result = analyzeText(prompt, "INPUT");
    
    // We only return partial results for the public scanner
    // to encourage them to provide an email for the full report.
    return NextResponse.json({
      riskScore: result.riskScore,
      riskTypes: result.riskTypes,
      action: result.action,
      findingsCount: result.findings.length,
      labels: Array.from(new Set(result.findings.map(f => f.label))),
    });
  } catch (error) {
    console.error("Scanner Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
