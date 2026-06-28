import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateApiKeyRequest } from "@/lib/apiKeyMiddleware";
import { DEFAULT_RPM } from "@/lib/guard/constants";
import { runOutputGuard } from "@/lib/guard/outputGuard";
import { applyPolicy, loadProjectPolicy } from "@/lib/guard/policy";
import { persistGuardResult } from "@/lib/guard/persistence";
import type { RiskType } from "@/lib/guard/types";
import { toPublicGuardResult } from "@/lib/guard/publicResult";
import { createRateLimitResult } from "@/lib/guard/rateLimitResult";
import { scheduleGuardResultPersistence } from "@/lib/guard/scheduledPersistence";
import { checkRedisRateLimit, peekMonthlyUsage, planLimit } from "@/lib/rateLimit";
import { outputGuardSchema } from "@/lib/validations";
import { recordRequestMetric } from "@/lib/ops/monitoring";
import { recordTrustEventSafe, trustTraceContextFromHeaders } from "@/lib/trust-events";
import { evaluateGovernance, logAiUsageEvent } from "@/lib/usage-governance";
import { dispatchGovernanceEnforcement } from "@/lib/usage-governance/notifications";

export async function POST(request: Request) {
  const startedAt = Date.now();
  let failed = false;
  try {
    const authenticated = await authenticateApiKeyRequest(request);
    if (!authenticated.ok) return authenticated.response;
    const { apiKey, project } = authenticated.auth;

    const orgId = project.organizationId;
    const [rpm, usage] = await Promise.all([
      checkRedisRateLimit(`key:${apiKey.id}`, DEFAULT_RPM),
      orgId
        ? peekMonthlyUsage(orgId, project.plan, project.organization?.quotaOverride)
        : Promise.resolve({ allowed: true, exceeded: false, remaining: planLimit(project.plan), limit: planLimit(project.plan), used: 0, ratio: 0, warning: false }),
    ]);

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

    const [body, policy] = await Promise.all([
      readJson(request).then((json) => outputGuardSchema.parse(json)),
      loadProjectPolicy(project.id),
    ]);

    // ── Provider governance enforcement ──
    if (body.providerName && orgId) {
      const decision = await evaluateGovernance(
        orgId,
        body.providerName,
        body.modelName,
        body.userId ?? undefined,
        undefined,
      );

      void logAiUsageEvent(
        orgId,
        body.userId ?? null,
        body.providerName,
        body.modelName ?? null,
        decision.allowed ? "ALLOWED" : "BLOCKED",
        `Output guard governance: ${decision.reason}`,
        `Provider: ${body.providerName}, Model: ${body.modelName ?? "any"}`,
      );

      if (decision.action === "BLOCK") {
        void dispatchGovernanceEnforcement({
          organizationId: orgId,
          projectId: project.id,
          providerName: body.providerName,
          modelName: body.modelName,
          enforcementAction: "BLOCK",
          reason: decision.reason,
          userId: body.userId,
        });

        const governanceResult = {
          allowed: false,
          action: "BLOCK" as const,
          riskScore: 0,
          riskTypes: [] as RiskType[],
          reason: `Blocked by governance policy: ${decision.reason}`,
          findings: [],
          metadata: {
            governanceBlocked: true,
            governanceAction: decision.action,
            governanceReason: decision.reason,
            providerName: body.providerName,
          },
        };
        scheduleGuardResultPersistence({
          projectId: project.id,
          apiKeyId: apiKey.id,
          direction: "OUTPUT",
          result: governanceResult,
          requestMetadata: { ...body.metadata, userId: body.userId ?? null, sessionId: body.sessionId ?? null },
          projectContext: project,
        });
        return jsonResponse(toPublicGuardResult(governanceResult), {
          status: 403,
          headers: {
            "X-RateLimit-Limit": String(DEFAULT_RPM),
            "X-RateLimit-Remaining": String(rpm.remaining),
            "X-Governance-Action": "BLOCK",
            "X-Governance-Reason": encodeURIComponent(decision.reason.slice(0, 200)),
          },
        });
      }

      if (decision.action === "REQUIRE_APPROVAL") {
        void dispatchGovernanceEnforcement({
          organizationId: orgId,
          projectId: project.id,
          providerName: body.providerName,
          modelName: body.modelName,
          enforcementAction: "REQUIRE_APPROVAL",
          reason: decision.reason,
          userId: body.userId,
        });

        const governanceResult = {
          allowed: false,
          action: "HUMAN_REVIEW" as const,
          riskScore: 0,
          riskTypes: [] as RiskType[],
          reason: `Requires governance approval: ${decision.reason}. Submit an approval request via the AI Usage Governance dashboard.`,
          findings: [],
          metadata: {
            governanceBlocked: true,
            governanceAction: decision.action,
            governanceReason: decision.reason,
            providerName: body.providerName,
          },
        };
        scheduleGuardResultPersistence({
          projectId: project.id,
          apiKeyId: apiKey.id,
          direction: "OUTPUT",
          result: governanceResult,
          requestMetadata: { ...body.metadata, userId: body.userId ?? null, sessionId: body.sessionId ?? null },
          projectContext: project,
        });
        return jsonResponse(toPublicGuardResult(governanceResult), {
          status: 403,
          headers: {
            "X-RateLimit-Limit": String(DEFAULT_RPM),
            "X-RateLimit-Remaining": String(rpm.remaining),
            "X-Governance-Action": "REQUIRE_APPROVAL",
            "X-Governance-Reason": encodeURIComponent(decision.reason.slice(0, 200)),
          },
        });
      }
    }

    const baseline = runOutputGuard(body.aiResponse);
    const result = applyPolicy(body.aiResponse, baseline, policy, "OUTPUT");
    scheduleGuardResultPersistence({
      projectId: project.id,
      apiKeyId: apiKey.id,
      direction: "OUTPUT",
      result,
      requestMetadata: { ...body.metadata, sessionId: body.sessionId ?? null },
      projectContext: project,
    });
    const trust = orgId ? await recordTrustEventSafe({
      organizationId: orgId,
      projectId: project.id,
      ...trustTraceContextFromHeaders(request),
      sessionId: body.sessionId ?? trustTraceContextFromHeaders(request).sessionId,
      eventType: "GUARD_OUTPUT_DECISION",
      source: "guard.output",
      action: "inspect_output",
      severity: guardSeverity(result.riskScore),
      decision: result.action === "BLOCK" ? "BLOCK" : result.action === "HUMAN_REVIEW" ? "ASK_APPROVAL" : "ALLOW",
      riskTypes: result.riskTypes,
      controlIds: ["AI-CTRL-01", "AI-CTRL-02"],
      resource: { type: "AI_OUTPUT", classification: result.riskTypes.some((risk) => risk.includes("PII") || risk === "SECRET_DETECTED") ? "SENSITIVE" : "UNCLASSIFIED" },
      metadata: { riskScore: result.riskScore, guardAction: result.action, findingCount: result.findings.length, apiKeyId: apiKey.id },
    }) : null;
    return jsonResponse(toPublicGuardResult(result), {
      headers: {
        "X-RateLimit-Limit": String(DEFAULT_RPM),
        "X-RateLimit-Remaining": String(rpm.remaining),
        ...(trust ? { "X-Soter-Trace-Id": trust.event.traceId, "X-Soter-Span-Id": trust.event.spanId } : {}),
      },
    });
  } catch (error) {
    failed = true;
    return apiError(error, "The output guard could not process this request.");
  } finally {
    void recordRequestMetric("guard_api_latency_ms", Date.now() - startedAt, failed);
  }
}

function guardSeverity(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}
