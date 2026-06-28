import { z } from "zod";
import { createHash } from "crypto";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { getVectorProvider } from "@/lib/rag/vector/vectorProvider";
import { createRagAuthorizationReceipt } from "@/lib/rag/authorizationContinuity";
import { recordTrustEvent } from "@/lib/trust-events";

const schema = z.object({
  projectId: z.string().min(1),
  query: z.string().trim().min(1).max(8_000),
  collectionId: z.string().min(1).optional(),
  allowedDocumentIds: z.array(z.string().min(1)).max(100).optional(),
  allowedSources: z.array(z.string().url()).max(100).optional(),
  allowedSensitivityLabels: z.array(z.string().min(1).max(50)).max(20).optional(),
  requirePrincipalAcl: z.boolean().default(false),
  minimumPermissionVersion: z.number().int().min(1).optional(),
  maxPermissionAgeHours: z.number().int().min(1).max(24 * 365).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "rag:read");
    const configuredMaxAge = Number(process.env.RAG_MAX_PERMISSION_AGE_HOURS ?? 0);
    const context = {
      organizationId: access.org.id,
      projectId: access.project.id,
      role: access.role,
      principalId: access.user.id,
      principalGroups: [`org:${access.org.id}`, `role:${access.role}`],
      requireExplicitPrincipalAcl: process.env.RAG_REQUIRE_PRINCIPAL_ACL === "true" || body.requirePrincipalAcl,
      minimumPermissionVersion: body.minimumPermissionVersion,
      maxPermissionAgeMs: (body.maxPermissionAgeHours ?? configuredMaxAge) > 0 ? (body.maxPermissionAgeHours ?? configuredMaxAge) * 3_600_000 : undefined,
      collectionId: body.collectionId,
      allowedDocumentIds: body.allowedDocumentIds,
      allowedSources: body.allowedSources,
      allowedSensitivityLabels: body.allowedSensitivityLabels,
    };
    const filters = { collectionId: body.collectionId, allowedSources: body.allowedSources, allowedSensitivityLabels: body.allowedSensitivityLabels, limit: body.limit };
    const results = await (await getVectorProvider()).query(body.query, context, filters);
    const receipts = results.map((result) => createRagAuthorizationReceipt(result, context, filters));
    const traceHeader = request.headers.get("x-soter-trace-id")?.toLowerCase();
    const parentHeader = request.headers.get("x-soter-parent-span-id")?.toLowerCase();
    const trustEvent = await recordTrustEvent({
      organizationId: access.org.id,
      projectId: access.project.id,
      traceId: traceHeader && /^[a-f0-9]{32}$/.test(traceHeader) ? traceHeader : undefined,
      parentSpanId: parentHeader && /^[a-f0-9]{16}$/.test(parentHeader) ? parentHeader : undefined,
      sessionId: request.headers.get("x-soter-session-id"),
      eventType: "RAG_AUTHORIZED_RETRIEVAL",
      source: "rag.query",
      action: "retrieve",
      severity: results.length ? "INFO" : "MEDIUM",
      decision: results.length ? "ALLOW" : "BLOCK",
      riskTypes: results.length ? [] : ["RAG_NO_AUTHORIZED_SOURCE"],
      controlIds: ["AI-CTRL-04"],
      resource: { type: "RAG_COLLECTION", id: body.collectionId ?? null, classification: body.allowedSensitivityLabels?.join(",") ?? null },
      metadata: {
        queryHash: createHash("sha256").update(body.query).digest("hex"),
        resultCount: results.length,
        authorizationProofHashes: receipts.map((receipt) => receipt.proofHash),
        strictPrincipalAcl: context.requireExplicitPrincipalAcl,
      },
    });
    return jsonResponse({ traceId: trustEvent.traceId, spanId: trustEvent.spanId, results: results.map(({ textRedacted, ...result }, index) => ({ ...result, text: textRedacted, authorization: receipts[index] })) });
  } catch (error) {
    return apiError(error, "RAG retrieval failed.");
  }
}
