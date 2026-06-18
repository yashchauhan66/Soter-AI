import { authenticateAdvancedSecurity, blastScenarioSchema, readAdvancedJson, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { BLAST_RADIUS_SCENARIOS, runBlastRadiusScenario, simulateBlastRadius, type BlastRadiusScenarioName } from "@/lib/advanced-security/blastRadius";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, blastScenarioSchema);
    const projectId = authenticated.auth.project.id;
    const scenarioName = (BLAST_RADIUS_SCENARIOS as readonly string[]).includes(body.scenarioName)
      ? (body.scenarioName as BlastRadiusScenarioName)
      : ("compromised_agent_data_exfiltration" as BlastRadiusScenarioName);

    const base = simulateBlastRadius(body);
    const scenario = runBlastRadiusScenario(body, scenarioName);

    await db.$executeRaw`
      INSERT INTO "BlastRadiusSimulation" ("id", "projectId", "agentRiskProfileId", "scenarioName", "scenarioJson", "resultJson", "blastRadiusScore", "riskLevel", "createdAt")
      VALUES (
        ${crypto.randomUUID()}, ${projectId}, ${null}, ${scenarioName},
        ${JSON.stringify({ agentName: body.agentName, scenarioName })}::jsonb,
        ${JSON.stringify(scenario)}::jsonb, ${scenario.blastRadiusScore}, ${scenario.riskLevel}, NOW()
      )
    `;

    return jsonResponse({
      scenarioName,
      baselineScore: base.blastRadiusScore,
      blastRadiusScore: scenario.blastRadiusScore,
      riskLevel: scenario.riskLevel,
      narrative: scenario.narrative,
      findings: base.findings,
      recommendations: base.recommendations,
    });
  } catch (error) {
    return routeError(error, "Blast radius scenario could not be run.");
  }
}
