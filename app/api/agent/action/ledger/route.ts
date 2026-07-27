import { z } from "zod";
import { createActionLedgerEntry } from "@/lib/agent-action-ledger";
import { authenticateAgentPassport, readPassportJson, routeError } from "@/lib/agent-passport/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";

const schema = z.object({
  sessionId: z.string().trim().max(200).optional(),
  agentIdentityId: z.string().trim().max(200).optional(),
  passportId: z.string().trim().max(200).optional(),
  tool: z.string().trim().min(1).max(200),
  action: z.string().trim().min(1).max(200),
  target: z.string().trim().max(2000).optional(),
  request: z.unknown().optional(),
  result: z.unknown().optional(),
  forwardAction: z.unknown().optional(),
  rollbackAction: z.unknown().optional(),
  idempotencyKey: z.string().trim().max(200).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentPassport(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readPassportJson(request, schema);
    const entry = createActionLedgerEntry({ ...body, projectId: authenticated.auth.project.id });

    await db.$executeRaw`
      INSERT INTO "AgentActionLedger" (
        "id", "projectId", "sessionId", "agentIdentityId", "passportId", "tool", "action",
        "targetRedacted", "actionHash", "idempotencyKey", "reversalStatus", "decision", "riskLevel",
        "forwardActionJson", "rollbackActionJson", "requestHash", "resultHash", "rollbackDeadline",
        "rollbackStatus", "irreversibleReason", "summary", "createdAt", "updatedAt"
      )
      VALUES (
        ${entry.id},
        ${authenticated.auth.project.id},
        ${body.sessionId ?? null},
        ${body.agentIdentityId ?? null},
        ${body.passportId ?? null},
        ${entry.tool},
        ${entry.action},
        ${entry.target ? sanitizeLogText(entry.target) : null},
        ${entry.actionHash},
        ${entry.idempotencyKey},
        ${entry.reversalStatus},
        ${entry.decision},
        ${entry.riskLevel},
        ${JSON.stringify(body.forwardAction ?? { tool: entry.tool, action: entry.action, target: entry.target })}::jsonb,
        ${entry.rollbackAction ? JSON.stringify(entry.rollbackAction) : null}::jsonb,
        ${entry.evidence.requestHash},
        ${entry.evidence.resultHash},
        ${entry.rollbackDeadline ? new Date(entry.rollbackDeadline) : null},
        'NOT_REQUESTED',
        ${entry.irreversibleReason},
        ${entry.summary},
        NOW(),
        NOW()
      )
      ON CONFLICT ("projectId", "idempotencyKey") DO UPDATE SET
        "updatedAt" = NOW()
    `;

    return jsonResponse(entry, { status: entry.decision === "BLOCK" ? 409 : 201 });
  } catch (error) {
    return routeError(error, "Agent action ledger entry could not be recorded.");
  }
}
