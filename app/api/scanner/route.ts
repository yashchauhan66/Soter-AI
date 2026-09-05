import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, readJson } from "@/lib/apiResponse";
import { analyzeText } from "@/lib/guard/analyze";
import { MAX_TEXT_LENGTH } from "@/lib/guard/constants";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

// This endpoint is unauthenticated by design (public lead-generation scanner),
// so the request body is the only thing standing between the internet and a
// regex-heavy analyzer. Reading it with `request.json()` behind a bare
// `typeof prompt === "string"` check — which is what this used to do — accepted
// an unbounded payload: App Router route handlers have no default body limit,
// and the per-IP rate limit below bounds the number of calls, not the CPU each
// one costs. Go through readJson (hard 32 KB cap enforced on the streamed bytes,
// plus per-string length validation) and hold the text to the same
// MAX_TEXT_LENGTH every other guard route already enforces via lib/validations.
const scannerSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required.").max(MAX_TEXT_LENGTH),
});

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

    const { prompt } = scannerSchema.parse(await readJson(request));

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
    return apiError(error, "Scan could not be completed.");
  }
}
