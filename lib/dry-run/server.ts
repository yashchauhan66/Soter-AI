import { z } from "zod";
import { jsonResponse } from "@/lib/apiResponse";
import { authenticateAdvancedSecurity, routeError } from "@/lib/advanced-security/server";
import { db } from "@/lib/db";
import {
  DRY_RUN_TYPES,
  createAgentDryRunId,
  sanitizeDryRunText,
  simulateAgentAction,
} from "@/lib/dry-run";

const dryRunType = z.enum(DRY_RUN_TYPES);

export const dryRunSimulateSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  agentIdentityId: z.string().trim().min(1).max(200).optional(),
  dryRunType,
  tool: z.string().trim().min(1).max(200),
  action: z.string().trim().min(1).max(300),
  target: z.string().trim().max(2000).optional(),
  simulatedPayload: z.string().max(50_000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type DryRunAuth = Extract<Awaited<ReturnType<typeof authenticateAdvancedSecurity>>, { ok: true }>["auth"];

type DryRunRow = {
  id: string;
  projectId: string;
  sessionId: string;
  agentIdentityId: string | null;
  dryRunType: string;
  tool: string;
  action: string;
  target: string | null;
  simulatedPayloadRedacted: string | null;
  simulatedEffectsJson: unknown;
  riskLevel: string;
  decision: string;
  reason: string;
  createdAt: Date;
};

export async function simulateAndPersistDryRun(auth: DryRunAuth, input: z.infer<typeof dryRunSimulateSchema>) {
  if (input.agentIdentityId) {
    const agent = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "AgentIdentity"
      WHERE "projectId" = ${auth.project.id} AND "id" = ${input.agentIdentityId}
      LIMIT 1
    `;
    if (!agent[0]) {
      return jsonResponse({ error: true, decision: "BLOCK", message: "Agent identity does not belong to this project." }, { status: 404 });
    }
  }

  const result = simulateAgentAction(input);
  const id = createAgentDryRunId();

  await db.$executeRaw`
    INSERT INTO "AgentDryRun" (
      "id", "projectId", "sessionId", "agentIdentityId", "dryRunType", "tool", "action",
      "target", "simulatedPayloadRedacted", "simulatedEffectsJson", "riskLevel", "decision", "reason", "createdAt"
    )
    VALUES (
      ${id},
      ${auth.project.id},
      ${input.sessionId},
      ${input.agentIdentityId ?? null},
      ${result.dryRunType}::"AgentDryRunType",
      ${sanitizeDryRunText(input.tool)},
      ${sanitizeDryRunText(input.action)},
      ${sanitizeDryRunText(input.target)},
      ${result.simulatedPayloadRedacted},
      ${JSON.stringify(result.simulatedEffects)}::jsonb,
      ${result.riskLevel},
      ${result.decision}::"AgentDryRunDecision",
      ${result.reason},
      NOW()
    )
  `;

  return jsonResponse({
    dryRunId: id,
    sessionId: input.sessionId,
    decision: result.decision,
    riskLevel: result.riskLevel,
    reason: result.reason,
    findings: result.findings,
    simulatedPayloadRedacted: result.simulatedPayloadRedacted,
    simulatedEffects: result.simulatedEffects,
  }, { status: 201 });
}

export async function getDryRun(auth: DryRunAuth, id: string) {
  const rows = await db.$queryRaw<DryRunRow[]>`
    SELECT "id", "projectId", "sessionId", "agentIdentityId", "dryRunType", "tool", "action",
      "target", "simulatedPayloadRedacted", "simulatedEffectsJson", "riskLevel", "decision", "reason", "createdAt"
    FROM "AgentDryRun"
    WHERE "projectId" = ${auth.project.id} AND "id" = ${id}
    LIMIT 1
  `;
  const dryRun = rows[0];
  if (!dryRun) return jsonResponse({ error: true, message: "Dry-run simulation not found." }, { status: 404 });
  return jsonResponse({ dryRun: publicDryRun(dryRun) });
}

export async function getDryRunsForSession(auth: DryRunAuth, sessionId: string) {
  const rows = await db.$queryRaw<DryRunRow[]>`
    SELECT "id", "projectId", "sessionId", "agentIdentityId", "dryRunType", "tool", "action",
      "target", "simulatedPayloadRedacted", "simulatedEffectsJson", "riskLevel", "decision", "reason", "createdAt"
    FROM "AgentDryRun"
    WHERE "projectId" = ${auth.project.id} AND "sessionId" = ${sessionId}
    ORDER BY "createdAt" DESC
    LIMIT 200
  `;
  return jsonResponse({ dryRuns: rows.map(publicDryRun) });
}

export { routeError };

function publicDryRun(row: DryRunRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    sessionId: row.sessionId,
    agentIdentityId: row.agentIdentityId,
    dryRunType: row.dryRunType,
    tool: row.tool,
    action: row.action,
    target: row.target,
    simulatedPayloadRedacted: row.simulatedPayloadRedacted,
    simulatedEffects: row.simulatedEffectsJson,
    riskLevel: row.riskLevel,
    decision: row.decision,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}
