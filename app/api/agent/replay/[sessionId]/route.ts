import { authenticateAgentFirewall, routeError } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { summarizeReplay } from "@/lib/agent-firewall/mvp3";
import { buildAgentIncidentPdf } from "@/lib/pdf/agentIncidentReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const { sessionId } = await params;
    const sessionRows = await db.$queryRaw<Array<{ id: string; agentName: string; agentType: string; status: string; createdAt: Date }>>`
      SELECT "id", "agentName", "agentType", "status", "createdAt"
      FROM "AgentSession"
      WHERE "id" = ${sessionId} AND "projectId" = ${authenticated.auth.project.id}
      LIMIT 1
    `;
    if (!sessionRows[0]) return jsonResponse({ error: true, message: "Session not found." }, { status: 404 });
    const [actions, approvals, memory] = await Promise.all([
      db.$queryRaw<Array<{ type: string; id: string; tool: string; action: string; decision: string; riskLevel: string; reason: string; createdAt: Date }>>`
        SELECT 'action' AS "type", "id", "tool", "action", "decision", "riskLevel", "reason", "createdAt"
        FROM "AgentActionLog"
        WHERE "sessionId" = ${sessionId} AND "projectId" = ${authenticated.auth.project.id}
      `,
      db.$queryRaw<Array<{ type: string; id: string; action: string; decision: string; riskLevel: string; reason: string; createdAt: Date }>>`
        SELECT 'approval' AS "type", "id", 'approval' AS "action", "status" AS "decision", 'HIGH' AS "riskLevel", "reason", "createdAt"
        FROM "AgentApproval"
        WHERE "sessionId" = ${sessionId} AND "projectId" = ${authenticated.auth.project.id}
      `,
      db.$queryRaw<Array<{ type: string; id: string; action: string; decision: string; riskLevel: string; reason: string; createdAt: Date }>>`
        SELECT 'memory' AS "type", "id", "action", "decision", "riskLevel", "reason", "createdAt"
        FROM "AgentMemoryEvent"
        WHERE "sessionId" = ${sessionId} AND "projectId" = ${authenticated.auth.project.id}
      `,
    ]);
    const timeline = [
      { type: "session", id: sessionRows[0].id, action: "start", decision: sessionRows[0].status, riskLevel: "LOW", reason: `${sessionRows[0].agentName} ${sessionRows[0].agentType}`, createdAt: sessionRows[0].createdAt },
      ...actions,
      ...approvals,
      ...memory,
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const replay = summarizeReplay(timeline);
    await db.$executeRaw`
      INSERT INTO "AgentReplay" ("id", "sessionId", "projectId", "replayJson", "summary", "riskLevel", "createdAt")
      VALUES (${crypto.randomUUID()}, ${sessionId}, ${authenticated.auth.project.id}, ${JSON.stringify(replay.timeline)}::jsonb, ${replay.summary}, ${replay.riskLevel}, NOW())
    `;
    const format = new URL(request.url).searchParams.get("format");
    if (format === "pdf") {
      const pdf = await buildAgentIncidentPdf({
        sessionId,
        projectId: authenticated.auth.project.id,
        summary: replay.summary,
        riskLevel: replay.riskLevel,
        timeline: replay.timeline,
      });
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="agent-incident-${sessionId}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return jsonResponse({ sessionId, summary: replay.summary, riskLevel: replay.riskLevel, timeline: replay.timeline });
  } catch (error) {
    return routeError(error, "Agent replay could not be loaded.");
  }
}
