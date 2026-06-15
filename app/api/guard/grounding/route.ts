import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { guardGroundedAnswer } from "@/lib/guard/groundingGuard";
import { loadProjectPolicy } from "@/lib/guard/policy";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { emitSecurityEvent } from "@/lib/events/emit";
import { authorizeGroundingChunks } from "@/lib/rag/groundingSources";
import { checkRedisRateLimit } from "@/lib/rateLimit";

const schema = z.object({
  projectId: z.string().min(1),
  answer: z.string().min(1).max(20_000),
  sources: z.array(z.object({ id: z.string().min(1), url: z.string().url().optional(), text: z.string().max(20_000).optional(), authorized: z.boolean().optional() })).max(100),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "rag:read");
    const rate = await checkRedisRateLimit(`guard:grounding:${access.org.id}:${access.project.id}`, 60, 60_000);
    if (!rate.allowed) return jsonResponse({ error: "Rate limit exceeded.", resetAt: rate.resetAt }, { status: 429 });
    const policy = await loadProjectPolicy(body.projectId);
    const requestedIds = [...new Set(body.sources.map((source) => source.id))];
    const storedChunks = requestedIds.length ? await db.ragChunk.findMany({
      where: { id: { in: requestedIds }, document: { collection: { organizationId: access.org.id, projectId: access.project.id } } },
      select: { id: true, textRedacted: true, sourceUrl: true, allowedRoles: true, document: { select: { status: true, collection: { select: { organizationId: true, projectId: true } } } } },
    }) : [];
    const sources = authorizeGroundingChunks(storedChunks, { organizationId: access.org.id, projectId: access.project.id, role: access.role });
    const result = guardGroundedAnswer({ answer: body.answer, sources, policy });
    await db.ragAnswerAuditLog.create({ data: {
      organizationId: access.org.id,
      projectId: access.project.id,
      answerHash: createHash("sha256").update(body.answer).digest("hex"),
      sourceCount: result.sourceCount,
      sourceCoverageScore: result.sourceCoverageScore,
      unsupportedClaimCount: result.unsupportedClaims.length,
      fallbackUsed: !result.allowed,
      metadata: { highRiskTopic: result.highRiskTopic, citationCount: result.citationVerification.citationCount, requestedSourceCount: requestedIds.length },
    } });
    if (!result.allowed) await emitSecurityEvent({ organizationId: access.org.id, projectId: access.project.id, eventType: "rag.no_source_fallback", severity: result.privateDocumentLeak ? "CRITICAL" : "MEDIUM", riskTypes: result.privateDocumentLeak ? ["PRIVATE_DOCUMENT_LEAK"] : ["INSUFFICIENT_SOURCE_ATTRIBUTION"], action: "SAFE_FALLBACK", source: "guard.grounding", metadata: { sourceCount: result.sourceCount, sourceCoverageScore: result.sourceCoverageScore } });
    return jsonResponse(result);
  } catch (error) { return apiError(error, "Grounding guard failed."); }
}
