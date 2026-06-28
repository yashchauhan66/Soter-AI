import { z } from "zod";
import { diffAgentPermissions } from "@/lib/agent-permission-diff";
import { authenticateAgentPassport, readPassportJson, routeError } from "@/lib/agent-passport/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

const manifestSchema = z.object({
  agentName: z.string().trim().max(160).optional(),
  version: z.string().trim().max(120).optional(),
  tools: z.array(z.string().trim().min(1).max(200)).max(250).optional(),
  approvalRequiredTools: z.array(z.string().trim().min(1).max(200)).max(250).optional(),
  blockedTools: z.array(z.string().trim().min(1).max(200)).max(250).optional(),
  allowedDomains: z.array(z.string().trim().min(1).max(240)).max(250).optional(),
  blockedDomains: z.array(z.string().trim().min(1).max(240)).max(250).optional(),
  dataScopes: z.array(z.string().trim().min(1).max(160)).max(250).optional(),
  memoryScopes: z.array(z.string().trim().min(1).max(160)).max(250).optional(),
  mcpServers: z.array(z.string().trim().min(1).max(240)).max(250).optional(),
  models: z.array(z.string().trim().min(1).max(160)).max(250).optional(),
});

const schema = z.object({
  deploymentId: z.string().trim().max(200).optional(),
  baseline: manifestSchema.optional(),
  candidate: manifestSchema,
  policy: z.object({
    blockOnCritical: z.boolean().optional(),
    reviewOnHigh: z.boolean().optional(),
    maxRiskIncrease: z.number().int().min(0).max(100).optional(),
    requireApprovalForNewHighRiskTools: z.boolean().optional(),
    deniedTools: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
    deniedDomains: z.array(z.string().trim().min(1).max(240)).max(100).optional(),
    deniedDataScopes: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  }).optional(),
  persist: z.boolean().default(true),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentPassport(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readPassportJson(request, schema);
    const result = diffAgentPermissions({ baseline: body.baseline, candidate: body.candidate, policy: body.policy });
    let gateId: string | undefined;

    if (body.persist) {
      const rows = await db.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "AgentPermissionDeploymentGate" (
          "id", "projectId", "deploymentId", "agentName", "baselineHash", "candidateHash",
          "riskBefore", "riskAfter", "riskDelta", "riskLevel", "decision",
          "findingsJson", "policyJson", "summary", "recommendation", "createdAt"
        )
        VALUES (
          ${crypto.randomUUID()},
          ${authenticated.auth.project.id},
          ${body.deploymentId ?? null},
          ${result.agentName},
          ${result.baselineHash},
          ${result.candidateHash},
          ${result.riskBefore},
          ${result.riskAfter},
          ${result.riskDelta},
          ${result.riskLevel},
          ${result.decision},
          ${JSON.stringify(result.findings)}::jsonb,
          ${JSON.stringify(body.policy ?? {})}::jsonb,
          ${result.summary},
          ${result.recommendation},
          NOW()
        )
        RETURNING "id"
      `;
      gateId = rows[0]?.id;
    }

    return jsonResponse({ gateId, ...result }, { status: result.decision === "BLOCK" ? 409 : 200 });
  } catch (error) {
    return routeError(error, "Agent permission deployment gate could not be evaluated.");
  }
}
