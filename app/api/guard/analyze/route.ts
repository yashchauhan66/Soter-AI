import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { analyzeText } from "@/lib/guard/analyze";
import { augmentWithMl } from "@/lib/guard/mlAugment";
import { augmentWithLlmJudge } from "@/lib/guard/llmJudge";
import { PUBLIC_ANALYZE_RPM } from "@/lib/guard/constants";
import { toPublicGuardResult } from "@/lib/guard/publicResult";
import { createRateLimitResult } from "@/lib/guard/rateLimitResult";
import { checkRedisRateLimit } from "@/lib/rateLimit";
import { analyzeSchema } from "@/lib/validations";
import { recordRequestMetric } from "@/lib/ops/monitoring";
import { trustedClientIp } from "@/lib/publicRateLimit";

export async function POST(request: Request) {
  const startedAt = Date.now();
  let failed = false;
  try {
    const identifier = trustedClientIp(request) || "local-public";
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
    // The public playground previously ran rules-only, making it strictly weaker
    // than the authenticated path — and it is the surface most likely to be probed.
    // augmentWithMl is additive and fail-open: it is a no-op unless the ML tier is
    // configured, and the precision gate keeps its benign FPR flat. So the public
    // analyzer now gets the same ML-boosted recall as /api/guard/input.
    const result = await augmentWithLlmJudge(
      await augmentWithMl(
        analyzeText(body.text, body.direction, body.source ? { provenance: body.source } : undefined),
        body.text,
        body.direction,
      ),
      body.text,
      body.direction,
    );
    result.metadata = { ...result.metadata, guardDirection: body.direction, requestDirection: "ANALYZE" };
    // Same latency contract as the authenticated guard routes: server-side
    // handling time only, in the body as well as the header, because an
    // integration platform maps fields and not headers.
    const latencyMs = Date.now() - startedAt;
    return jsonResponse({ ...toPublicGuardResult(result), latencyMs }, {
      headers: {
        "X-RateLimit-Limit": String(PUBLIC_ANALYZE_RPM),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-Soter-Latency-Ms": String(latencyMs),
      },
    });
  } catch (error) {
    failed = true;
    return apiError(error, "The analysis could not be completed.");
  } finally {
    void recordRequestMetric("guard_api_latency_ms", Date.now() - startedAt, failed);
  }
}
