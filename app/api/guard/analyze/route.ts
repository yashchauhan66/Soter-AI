import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { analyzeText } from "@/lib/guard/analyze";
import { PUBLIC_ANALYZE_RPM } from "@/lib/guard/constants";
import { toPublicGuardResult } from "@/lib/guard/publicResult";
import { createRateLimitResult } from "@/lib/guard/rateLimitResult";
import { checkRedisRateLimit } from "@/lib/rateLimit";
import { analyzeSchema } from "@/lib/validations";
import { recordRequestMetric } from "@/lib/ops/monitoring";

export async function POST(request: Request) {
  const startedAt = Date.now();
  let failed = false;
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const identifier = forwarded || request.headers.get("x-real-ip") || "local-public";
    const rateLimit = await checkRedisRateLimit(`public:${identifier}`, PUBLIC_ANALYZE_RPM);
    if (!rateLimit.allowed) {
      const result = createRateLimitResult("Public playground rate limit was exceeded.");
      return jsonResponse(toPublicGuardResult(result), {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Limit": String(PUBLIC_ANALYZE_RPM),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      });
    }
    const body = analyzeSchema.parse(await readJson(request));
    const result = analyzeText(body.text, body.direction);
    result.metadata = { ...result.metadata, guardDirection: body.direction, requestDirection: "ANALYZE" };
    return jsonResponse(toPublicGuardResult(result), {
      headers: { "X-RateLimit-Limit": String(PUBLIC_ANALYZE_RPM), "X-RateLimit-Remaining": String(rateLimit.remaining) },
    });
  } catch (error) {
    failed = true;
    return apiError(error, "The analysis could not be completed.");
  } finally {
    void recordRequestMetric("guard_api_latency_ms", Date.now() - startedAt, failed);
  }
}
