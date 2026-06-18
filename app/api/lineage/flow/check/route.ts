import { authenticateAdvancedSecurity, flowCheckSchema, readAdvancedJson, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { decideContextFlow, type ContextSourceInput, type SensitivityLevel, type SourceTrustLevel, type SourceType } from "@/lib/advanced-security/lineage";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export const dynamic = "force-dynamic";

type SourceRow = { id: string; sourceType: string; sourceName: string | null; sourceTrustLevel: string; sensitivityLevel: string };

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, flowCheckSchema);
    const projectId = authenticated.auth.project.id;

    // Load registered sources, strictly scoped to this project (tenant isolation).
    let sources: ContextSourceInput[] = [];
    if (body.sourceIds.length > 0) {
      const rows = await db.$queryRaw<SourceRow[]>`
        SELECT "id", "sourceType", "sourceName", "sourceTrustLevel", "sensitivityLevel"
        FROM "ContextSource"
        WHERE "projectId" = ${projectId} AND "id" = ANY(${body.sourceIds}::text[])
      `;
      sources = rows.map((row) => ({
        sourceId: row.id,
        sourceType: row.sourceType as SourceType,
        sourceName: row.sourceName ?? undefined,
        sourceTrustLevel: row.sourceTrustLevel as SourceTrustLevel,
        sensitivityLevel: row.sensitivityLevel as SensitivityLevel,
      }));
    }

    const decision = decideContextFlow({
      sources,
      destinationType: body.destinationType,
      destinationName: body.destinationName,
      destinationTrustLevel: body.destinationTrustLevel,
      action: body.action,
      content: body.content,
      regulatedEgress: body.regulatedEgress,
    });

    const flowId = crypto.randomUUID();
    await db.$executeRaw`
      INSERT INTO "ContextFlow" ("id", "projectId", "sessionId", "sourceId", "destinationType", "destinationName", "destinationTrustLevel", "action", "decision", "riskLevel", "reason", "redactionsJson", "policyMatchesJson", "createdAt")
      VALUES (
        ${flowId}, ${projectId}, ${body.sessionId ?? null}, ${sources[0]?.sourceId ?? null},
        ${body.destinationType}, ${body.destinationName ? sanitizeLogText(body.destinationName) : null}, ${body.destinationTrustLevel},
        ${body.action ?? null}, ${decision.decision}, ${decision.riskLevel}, ${decision.reason},
        ${JSON.stringify(decision.redactions)}::jsonb, ${JSON.stringify(decision.policyMatches)}::jsonb, NOW()
      )
    `;

    // Persist an incident for risky flows.
    let lineageIncidentId: string | null = null;
    if (decision.incidentType && decision.decision !== "ALLOW") {
      lineageIncidentId = crypto.randomUUID();
      await db.$executeRaw`
        INSERT INTO "LineageIncident" ("id", "projectId", "sessionId", "incidentType", "riskLevel", "summary", "involvedSourcesJson", "involvedDestinationsJson", "recommendedFix", "status", "createdAt", "updatedAt")
        VALUES (
          ${lineageIncidentId}, ${projectId}, ${body.sessionId ?? null}, ${decision.incidentType}, ${decision.riskLevel}, ${decision.reason},
          ${JSON.stringify(sources.map((source) => ({ sourceId: source.sourceId, sourceType: source.sourceType, sensitivityLevel: source.sensitivityLevel })))}::jsonb,
          ${JSON.stringify([{ destinationType: body.destinationType, destinationName: body.destinationName ? sanitizeLogText(body.destinationName) : null, destinationTrustLevel: body.destinationTrustLevel }])}::jsonb,
          ${`Recommended: ${decision.decision === "BLOCK" ? "keep blocking and tighten destination allowlist" : "require approval and review the source"}.`},
          'OPEN', NOW(), NOW()
        )
      `;
    }

    return jsonResponse({
      decision: decision.decision,
      riskLevel: decision.riskLevel,
      reason: decision.reason,
      safeContent: decision.safeContent,
      redactions: decision.redactions,
      lineageIncidentId,
      policyMatches: decision.policyMatches,
    });
  } catch (error) {
    return routeError(error, "Context flow could not be checked.");
  }
}
