import { authenticateAdvancedSecurity, legalBoundarySchema, readAdvancedJson, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { checkLegalBoundary, type LegalBoundaryPolicy } from "@/lib/advanced-security/legalBoundary";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, legalBoundarySchema);
    const projectId = authenticated.auth.project.id;

    // Load the active project legal-boundary policy (most recent enabled).
    const policyRows = await db.$queryRaw<Array<{ rulesJson: unknown }>>`
      SELECT "rulesJson" FROM "LegalBoundaryPolicy" WHERE "projectId" = ${projectId} AND "enabled" = true ORDER BY "updatedAt" DESC LIMIT 1
    `;
    const policy = (policyRows[0]?.rulesJson && typeof policyRows[0].rulesJson === "object"
      ? policyRows[0].rulesJson
      : {}) as LegalBoundaryPolicy;

    const result = checkLegalBoundary({ ...body, policy });
    const auditId = crypto.randomUUID();
    await db.$executeRaw`
      INSERT INTO "LegalBoundaryCheck" ("id", "projectId", "sessionId", "agentName", "websiteUrl", "domain", "action", "actionCategory", "userConsentProvided", "riskLevel", "decision", "reason", "evidenceJson", "createdAt")
      VALUES (
        ${auditId}, ${projectId}, ${body.sessionId ?? null}, ${body.agentName},
        ${body.websiteUrl ? sanitizeLogText(body.websiteUrl) : null}, ${body.domain ?? null},
        ${body.action ? sanitizeLogText(body.action) : null}, ${body.actionCategory}, ${body.userConsentProvided},
        ${result.riskLevel}, ${result.decision}, ${result.reason}, ${JSON.stringify(result.evidence)}::jsonb, NOW()
      )
    `;

    return jsonResponse({
      decision: result.decision,
      riskLevel: result.riskLevel,
      reason: result.reason,
      requiredUserMessage: result.requiredUserMessage,
      evidence: result.evidence,
      auditId,
    });
  } catch (error) {
    return routeError(error, "Legal boundary could not be checked.");
  }
}
