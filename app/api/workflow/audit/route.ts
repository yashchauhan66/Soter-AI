import { apiError, jsonResponse, readJson, requireJsonContentType } from "@/lib/apiResponse";
import { authenticateApiKeyRequest } from "@/lib/apiKeyMiddleware";
import { auditWorkflow, WorkflowAuditError } from "@/lib/guard/workflowAudit";
import { checkRedisRateLimit, planRpm } from "@/lib/rateLimit";
import { createRateLimitResult } from "@/lib/guard/rateLimitResult";
import { toPublicGuardResult } from "@/lib/guard/publicResult";
import { recordRequestMetric } from "@/lib/ops/monitoring";
import { workflowAuditSchema } from "@/lib/validations";

// Static OWASP LLM Top 10 audit of an exported n8n workflow.
//
// This endpoint exists for Make.com. Make custom apps are declarative JSON over
// HTTP and cannot execute arbitrary code, so the audit — which n8n and Zapier
// both run locally with zero network — has to be reachable as a request there.
// The rules themselves live in `lib/guard/workflowAudit.ts` so all three
// platforms share one implementation rather than three that drift.
//
// The audit is pure and static: it parses JSON and applies regexes. It never
// executes the workflow, resolves a credential, or contacts anything the
// workflow references. It also does not persist the submitted workflow — a
// customer's workflow export is one of the most sensitive artifacts they have
// (node names, endpoints, sometimes inline secrets), and storing it to build a
// dashboard would be a worse trade than the dashboard is worth.

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
    const rpm = await checkRedisRateLimit(`workflow-audit:key:${apiKey.id}`, rpmLimit);
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

    const body = workflowAuditSchema.parse(await readJson(request));
    const result = auditWorkflow(body.workflowJson);

    return jsonResponse(result, {
      headers: {
        "X-RateLimit-Limit": String(rpmLimit),
        "X-RateLimit-Remaining": String(rpm.remaining),
        "X-Soter-Latency-Ms": String(Date.now() - startedAt),
      },
    });
  } catch (error) {
    // A malformed workflow export is the caller's mistake, not a server fault,
    // and it is the single most likely error here — so it gets a 400 with the
    // actual reason rather than being folded into a generic 500.
    if (error instanceof WorkflowAuditError) {
      return jsonResponse({ error: "INVALID_WORKFLOW", message: error.message }, { status: 400 });
    }
    failed = true;
    return apiError(error, "The workflow audit could not process this request.");
  } finally {
    void recordRequestMetric("workflow_audit_latency_ms", Date.now() - startedAt, failed);
  }
}
