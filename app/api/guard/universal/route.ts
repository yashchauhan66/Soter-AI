import { apiError, jsonResponse, readJson, requireJsonContentType } from "@/lib/apiResponse";
import { authenticateApiKeyRequest } from "@/lib/apiKeyMiddleware";
import { runInputGuard } from "@/lib/guard/inputGuard";
import { runOutputGuard } from "@/lib/guard/outputGuard";
import { applyPolicy, loadProjectPolicy } from "@/lib/guard/policy";
import { toPublicGuardResult } from "@/lib/guard/publicResult";
import { createRateLimitResult } from "@/lib/guard/rateLimitResult";
import { scheduleGuardResultPersistence } from "@/lib/guard/scheduledPersistence";
import { checkRedisRateLimit, planRpm } from "@/lib/rateLimit";
import { universalGuardSchema } from "@/lib/validations";
import { recordRequestMetric } from "@/lib/ops/monitoring";
import type { GuardResult } from "@/lib/guard/types";

// One request, both directions, one combined verdict.
//
// This endpoint exists for Make.com. A Make custom app is declarative JSON over
// HTTP: a module is one request, and it cannot branch, loop, or chain. n8n and
// Zapier run their Universal Guard by orchestrating several calls in code,
// which Make structurally cannot do — so without this, "Universal Guard" would
// be the one operation Make could never have, and the parity claim would be
// false.
//
// Scope is deliberately input + output + topical, not every layer. The RAG,
// tool-call, and agent layers each have their own Make module already, and
// folding them in here would mean this endpoint silently performing agent
// policy checks under a project's guard rate limit — a different thing than
// what the name says. Callers who need those compose the existing modules.

export async function POST(request: Request) {
  const ctError = requireJsonContentType(request);
  if (ctError) return ctError;
  const startedAt = Date.now();
  let failed = false;
  try {
    const authenticated = await authenticateApiKeyRequest(request);
    if (!authenticated.ok) return authenticated.response;
    const { apiKey, project } = authenticated.auth;

    const rpmLimit = planRpm(project.plan);
    const rpm = await checkRedisRateLimit(`key:${apiKey.id}`, rpmLimit);
    if (!rpm.allowed) {
      return jsonResponse(
        toPublicGuardResult(createRateLimitResult("Per-minute API key rate limit was exceeded.")),
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((rpm.resetAt - Date.now()) / 1000))),
            "X-RateLimit-Limit": String(rpmLimit),
            "X-RateLimit-Remaining": String(rpm.remaining),
          },
        },
      );
    }

    const [body, policy] = await Promise.all([
      readJson(request).then((json) => universalGuardSchema.parse(json)),
      loadProjectPolicy(project.id),
    ]);

    const decisionContext = {
      ...(body.source ? { provenance: body.source } : {}),
      ...(body.allowedTopics ? { allowedTopics: body.allowedTopics } : {}),
      ...(body.systemPromptContext ? { systemPromptContext: body.systemPromptContext } : {}),
      ...(typeof body.minTopicRelevance === "number" ? { minTopicRelevance: body.minTopicRelevance } : {}),
    };

    const layers: Array<{ layer: string; result: GuardResult }> = [];

    const inputResult = applyPolicy(
      body.message,
      runInputGuard(body.message, decisionContext),
      policy,
      "INPUT",
      decisionContext,
    );
    layers.push({ layer: "input", result: inputResult });

    if (body.aiResponse?.trim()) {
      // The output layer never inherits the input's topical scope: an off-topic
      // *reply* is a quality problem, not a security one, and reporting it here
      // would put OFF_TOPIC on results the caller cannot act on.
      const outputResult = applyPolicy(
        body.aiResponse,
        runOutputGuard(body.aiResponse),
        policy,
        "OUTPUT",
        body.source ? { provenance: body.source } : undefined,
      );
      layers.push({ layer: "output", result: outputResult });
    }

    const combined = combineLayers(layers, body.profile);

    for (const { layer, result } of layers) {
      scheduleGuardResultPersistence({
        projectId: project.id,
        apiKeyId: apiKey.id,
        apiKeyPrefix: apiKey.prefix,
        direction: layer === "output" ? "OUTPUT" : "INPUT",
        result,
        requestMetadata: { ...body.metadata, universalLayer: layer, protectionProfile: body.profile },
        projectContext: project,
      });
    }

    return jsonResponse(
      {
        finalDecision: combined.decision,
        allowed: combined.decision !== "BLOCK",
        needsHumanReview: combined.decision === "ASK_APPROVAL",
        riskLevel: combined.riskLevel,
        riskScore: combined.riskScore,
        riskTypes: combined.riskTypes,
        primaryRiskType: combined.primaryRiskType,
        categoryConfidence: combined.categoryConfidence,
        reason: combined.reason,
        safeText: combined.safeText,
        layersRun: layers.map((entry) => entry.layer),
        checks: layers.map((entry) => ({ layer: entry.layer, ...toPublicGuardResult(entry.result) })),
        latencyMs: Date.now() - startedAt,
      },
      {
        headers: {
          "X-RateLimit-Limit": String(rpmLimit),
          "X-RateLimit-Remaining": String(rpm.remaining),
          "X-Soter-Latency-Ms": String(Date.now() - startedAt),
        },
      },
    );
  } catch (error) {
    failed = true;
    return apiError(error, "The universal guard could not process this request.");
  } finally {
    void recordRequestMetric("guard_api_latency_ms", Date.now() - startedAt, failed);
  }
}

/**
 * Folds the per-layer results into one verdict.
 *
 * Thresholds are transcribed from the n8n node's `decideUniversal`
 * (SoterGuard.node.ts) rather than reinvented. Two platforms returning
 * different verdicts for the same content is the exact failure this parity work
 * exists to prevent, so when these need to change they change in both places.
 */
function combineLayers(
  layers: Array<{ layer: string; result: GuardResult }>,
  profile: "BALANCED" | "STRICT" | "MAXIMUM",
) {
  const worst = layers.reduce(
    (current, entry) => (entry.result.riskScore > current.result.riskScore ? entry : current),
    layers[0],
  );

  let decision = layers.some((entry) => entry.result.action === "BLOCK")
    ? "BLOCK"
    : layers.some((entry) => entry.result.action === "HUMAN_REVIEW")
      ? "ASK_APPROVAL"
      : layers.some((entry) => entry.result.action === "REWRITE")
        ? "REDACT"
        : "ALLOW";

  const riskScore = worst?.result.riskScore ?? 0;
  if (profile === "MAXIMUM") {
    if (riskScore >= 75) decision = "BLOCK";
    else if (riskScore >= 55 && decision === "ALLOW") decision = "ASK_APPROVAL";
  } else if (profile === "STRICT") {
    if (riskScore >= 85) decision = "BLOCK";
    else if (riskScore >= 65 && decision === "ALLOW") decision = "ASK_APPROVAL";
  }

  const riskTypes = [...new Set(layers.flatMap((entry) => entry.result.riskTypes))];
  const safeText =
    layers.find((entry) => entry.layer === "output")?.result.safeText ??
    layers[0]?.result.safeText ??
    null;

  return {
    decision,
    riskLevel: riskLevelFromScore(riskScore),
    riskScore,
    riskTypes,
    primaryRiskType: worst?.result.primaryRiskType ?? null,
    categoryConfidence: worst?.result.categoryConfidence ?? {},
    reason: `${worst?.layer ?? "input"}: ${worst?.result.reason ?? "All enabled AI security checks passed."}`,
    safeText,
  };
}

/** Same bands as SoterGuard.node.ts and lib/guard/workflowAudit.ts. */
function riskLevelFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}
