import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { redeemEnrollmentToken } from "@/lib/extension/enrollment";
import { checkRateLimit } from "@/lib/extension/rateLimiter";

export const dynamic = "force-dynamic";

const enrollSchema = z.object({
  enrollmentCode: z.string().trim().min(20).max(500),
  browser: z.enum(["chrome", "edge", "unknown"]).optional(),
  extensionVersion: z.string().trim().max(40).optional(),
  platform: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const body = enrollSchema.parse(await readJson(request));
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimit = await checkRateLimit("extension-enroll", forwarded);
    if (!rateLimit.allowed) return jsonResponse({ error: true, message: "Too many enrollment attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } });
    const result = await redeemEnrollmentToken({ ...body, apiBaseUrl: new URL(request.url).origin });
    if (!result.ok) return jsonResponse({ error: true, code: result.status, message: result.message }, { status: result.status === "invalid" ? 401 : 410 });
    return jsonResponse(result, { status: 201 });
  } catch (error) {
    return apiError(error, "Extension enrollment failed.");
  }
}
