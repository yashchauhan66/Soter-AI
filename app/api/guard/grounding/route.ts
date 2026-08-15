import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { guardGroundedAnswer } from "@/lib/guard/groundingGuard";
import { loadProjectPolicy } from "@/lib/guard/policy";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { emitSecurityEvent } from "@/lib/events/emit";
import { authorizeGroundingChunks } from "@/lib/rag/groundingSources";
import { toPublicGuardResult } from "@/lib/guard/publicResult";
import { createRateLimitResult } from "@/lib/guard/rateLimitResult";
import { checkRedisRateLimit, planRpm } from "@/lib/rateLimit";
import { eventStoreFlags, writeRagSecurityEvent } from "@/lib/events/store";

const schema = z.object({
  projectId: z.string().min(1),
  answer: z.string().min(1).max(20_000),
  sources: z.array(z.object({ id: z.string().min(1), url: z.string().url().optional(), text: z.string().max(20_000).optional(), authorized: z.boolean().optional() })).max(100),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "rag:read");
    // Plan-aware, matching /api/guard/input. A hardcoded 60 capped paid plans at
    // the FREE rate. The 429 also carried no Retry-After, so the n8n client's
    // parseRetryAfterMs() backoff fell through to a blind 5s exponential wait.
    const rpmLimit = planRpm(access.project.plan);
    const rate = await checkRedisRateLimit(`guard:grounding:${access.org.id}:${access.project.id}`, rpmLimit, 60_000);
    if (!rate.allowed) {
      return jsonResponse(toPublicGuardResult(createRateLimitResult("Grounding guard per-minute rate limit exceeded.")), {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Limit": String(rpmLimit),
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      });
    }
    const policy = await loadProjectPolicy(body.projectId);
    const requestedIds = [...new Set(body.sources.map((source) => source.id))];
    const storedChunks = requestedIds.length ? await db.ragChunk.findMany({
      where: { id: { in: requestedIds }, document: { collection: { organizationId: access.org.id, projectId: access.project.id } } },
      select: { id: true, textRedacted: true, sourceUrl: true, allowedRoles: true, document: { select: { status: true, collection: { select: { organizationId: true, projectId: true } } } } },
    }) : [];
    const sources = authorizeGroundingChunks(storedChunks, { organizationId: access.org.id, projectId: access.project.id, role: access.role });
    const result = guardGroundedAnswer({ answer: body.answer, sources, policy });
    const answerAudit = {
      organizationId: access.org.id,
      projectId: access.project.id,
      answerHash: createHash("sha256").update(body.answer).digest("hex"),
      sourceCount: result.sourceCount,
      sourceCoverageScore: result.sourceCoverageScore,
      unsupportedClaimCount: result.unsupportedClaims.length,
      fallbackUsed: !result.allowed,
      metadata: { highRiskTopic: result.highRiskTopic, citationCount: result.citationVerification.citationCount, requestedSourceCount: requestedIds.length },
    };
    const flags = eventStoreFlags();
    if (!flags.enabled || flags.dualWrite) await db.ragAnswerAuditLog.create({ data: answerAudit });
    if (flags.enabled) {
      await writeRagSecurityEvent({
        orgId: access.org.id,
        projectId: access.project.id,
        action: "rag.grounding",
        decision: result.allowed ? "ALLOW" : "BLOCK",
        status: "COMPLETED",
        riskScore: result.allowed ? 0 : result.privateDocumentLeak ? 100 : 60,
        metadata: answerAudit,
      });
    }
    if (!result.allowed) await emitSecurityEvent({ organizationId: access.org.id, projectId: access.project.id, eventType: "rag.no_source_fallback", severity: result.privateDocumentLeak ? "CRITICAL" : "MEDIUM", riskTypes: result.privateDocumentLeak ? ["PRIVATE_DOCUMENT_LEAK"] : ["INSUFFICIENT_SOURCE_ATTRIBUTION"], action: "SAFE_FALLBACK", source: "guard.grounding", metadata: { sourceCount: result.sourceCount, sourceCoverageScore: result.sourceCoverageScore } });
    return jsonResponse(result);
  } catch (error) { return apiError(error, "Grounding guard failed."); }
}
