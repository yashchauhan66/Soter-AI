import { z } from "zod";
import { validateRollbackAttempt, type AgentActionLedgerEntry } from "@/lib/agent-action-ledger";
import { authenticateAgentPassport, routeError } from "@/lib/agent-passport/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const rollbackSchema = z.object({
  dryRun: z.boolean().default(false),
  reason: z.string().trim().max(500).optional(),
});

type LedgerRow = {
  id: string;
  reversalStatus: AgentActionLedgerEntry["reversalStatus"];
  rollbackActionJson: unknown;
  rollbackDeadline: Date | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authenticated = await authenticateAgentPassport(request);
    if (!authenticated.ok) return authenticated.response;
    const rawBody = await request.text();
    const body = rollbackSchema.parse(rawBody.trim() ? JSON.parse(rawBody) : {});
    const { id } = await params;
    const rows = await db.$queryRaw<LedgerRow[]>`
      SELECT "id", "reversalStatus", "rollbackActionJson", "rollbackDeadline"
      FROM "AgentActionLedger"
      WHERE "id" = ${id} AND "projectId" = ${authenticated.auth.project.id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return jsonResponse({ error: true, message: "Agent action ledger entry not found." }, { status: 404 });

    const validation = validateRollbackAttempt({
      reversalStatus: row.reversalStatus,
      rollbackDeadline: row.rollbackDeadline?.toISOString() ?? null,
      rollbackAction: row.rollbackActionJson,
    });
    if (!body.dryRun) {
      await db.$executeRaw`
        UPDATE "AgentActionLedger"
        SET "rollbackStatus" = ${validation.allowed ? "ROLLBACK_READY" : "ROLLBACK_BLOCKED"},
            "rollbackAttemptedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE "id" = ${id} AND "projectId" = ${authenticated.auth.project.id}
      `;
    }

    return jsonResponse({
      ledgerId: id,
      ...validation,
      dryRun: body.dryRun,
      reason: body.reason ?? null,
      rollbackAction: validation.allowed ? row.rollbackActionJson : null,
    }, { status: validation.allowed ? 200 : 409 });
  } catch (error) {
    return routeError(error, "Agent action rollback could not be prepared.");
  }
}
