import { authenticateAdvancedSecurity, blastSimulateSchema, readAdvancedJson, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { simulateBlastRadius } from "@/lib/advanced-security/blastRadius";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, blastSimulateSchema);
    const projectId = authenticated.auth.project.id;
    const result = simulateBlastRadius(body);

    await db.$executeRaw`
      INSERT INTO "AgentRiskProfile" ("id", "projectId", "agentName", "agentType", "toolsJson", "permissionsJson", "dataSourcesJson", "externalDestinationsJson", "memoryAccessJson", "policyJson", "blastRadiusScore", "riskLevel", "findingsJson", "recommendationsJson", "createdAt", "updatedAt")
      VALUES (
        ${crypto.randomUUID()}, ${projectId}, ${body.agentName}, ${body.agentType ?? null},
        ${JSON.stringify(body.tools)}::jsonb, ${JSON.stringify(body.permissions ?? {})}::jsonb,
        ${JSON.stringify(body.dataSources)}::jsonb, ${JSON.stringify(body.externalDestinations)}::jsonb,
        ${JSON.stringify(body.memoryAccess ?? {})}::jsonb, ${JSON.stringify(body.policies ?? {})}::jsonb,
        ${result.blastRadiusScore}, ${result.riskLevel}, ${JSON.stringify(result.findings)}::jsonb, ${JSON.stringify(result.recommendations)}::jsonb, NOW(), NOW()
      )
      ON CONFLICT ("projectId", "agentName") DO UPDATE SET
        "agentType" = EXCLUDED."agentType", "toolsJson" = EXCLUDED."toolsJson", "permissionsJson" = EXCLUDED."permissionsJson",
        "dataSourcesJson" = EXCLUDED."dataSourcesJson", "externalDestinationsJson" = EXCLUDED."externalDestinationsJson",
        "memoryAccessJson" = EXCLUDED."memoryAccessJson", "policyJson" = EXCLUDED."policyJson",
        "blastRadiusScore" = EXCLUDED."blastRadiusScore", "riskLevel" = EXCLUDED."riskLevel",
        "findingsJson" = EXCLUDED."findingsJson", "recommendationsJson" = EXCLUDED."recommendationsJson", "updatedAt" = NOW()
    `;

    return jsonResponse({
      blastRadiusScore: result.blastRadiusScore,
      riskLevel: result.riskLevel,
      findings: result.findings,
      recommendations: result.recommendations,
      scenarioResults: result.scenarioResults,
    });
  } catch (error) {
    return routeError(error, "Blast radius could not be simulated.");
  }
}
