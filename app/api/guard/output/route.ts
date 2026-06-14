import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateApiKeyRequest } from "@/lib/apiKeyMiddleware";
import { DEFAULT_RPM } from "@/lib/guard/constants";
import { runOutputGuard } from "@/lib/guard/outputGuard";
import { applyPolicy, loadProjectPolicy } from "@/lib/guard/policy";
import { persistGuardResult } from "@/lib/guard/persistence";
import { toPublicGuardResult } from "@/lib/guard/publicResult";
import { createRateLimitResult } from "@/lib/guard/rateLimitResult";
import { checkRedisRateLimit, peekMonthlyUsage, planLimit } from "@/lib/rateLimit";
import { outputGuardSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateApiKeyRequest(request);
    if (!authenticated.ok) return authenticated.response;
    const { apiKey, project } = authenticated.auth;

    const rpm = await checkRedisRateLimit(`key:${apiKey.id}`, DEFAULT_RPM);
    const orgId = project.organizationId;
    const usage = orgId
      ? await peekMonthlyUsage(orgId, project.plan, project.organization?.quotaOverride)
      : { allowed: true, exceeded: false, remaining: planLimit(project.plan), limit: planLimit(project.plan), used: 0, ratio: 0, warning: false };

    if (!rpm.allowed || usage.exceeded) {
      const result = createRateLimitResult(
        usage.exceeded
          ? "Monthly usage limit exceeded. Upgrade your plan to continue."
          : "Per-minute API key rate limit was exceeded.",
      );
      await persistGuardResult({
        projectId: project.id,
        apiKeyId: apiKey.id,
        direction: "OUTPUT",
        result,
        requestMetadata: { limitType: usage.exceeded ? "monthly" : "rpm" },
        projectContext: project,
      });
      const nextMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));
      const retryAfter = usage.exceeded
        ? Math.max(1, Math.ceil((nextMonth.getTime() - Date.now()) / 1000))
        : Math.max(1, Math.ceil((rpm.resetAt - Date.now()) / 1000));
      return jsonResponse(toPublicGuardResult(result), {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(DEFAULT_RPM),
          "X-RateLimit-Remaining": String(rpm.remaining),
        },
      });
    }

    const body = outputGuardSchema.parse(await readJson(request));
    const baseline = runOutputGuard(body.aiResponse);
    const policy = await loadProjectPolicy(project.id);
    const result = applyPolicy(body.aiResponse, baseline, policy, "OUTPUT");
    await persistGuardResult({
      projectId: project.id,
      apiKeyId: apiKey.id,
      direction: "OUTPUT",
      result,
      requestMetadata: { ...body.metadata, sessionId: body.sessionId ?? null },
      projectContext: project,
    });
    return jsonResponse(toPublicGuardResult(result), {
      headers: { "X-RateLimit-Limit": String(DEFAULT_RPM), "X-RateLimit-Remaining": String(rpm.remaining) },
    });
  } catch (error) {
    return apiError(error, "The output guard could not process this request.");
  }
}
