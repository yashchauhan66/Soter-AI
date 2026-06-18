import { authenticateAdvancedSecurity, mcpToolSnapshotSchema, readAdvancedJson, routeError } from "@/lib/advanced-security/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { diffSnapshots, serverRiskLevel, snapshotTool, type McpToolSnapshot } from "@/lib/advanced-security/mcpDrift";

export const dynamic = "force-dynamic";

type ServerRow = { id: string; status: string };
type SnapshotRow = {
  toolDescriptionHash: string; inputSchemaHash: string; outputSchemaHash: string | null; endpointHash: string | null;
  detectedCapabilitiesJson: unknown; riskLevel: string; riskReasonsJson: unknown; toolDescriptionRedacted: string | null;
};

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAdvancedSecurity(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAdvancedJson(request, mcpToolSnapshotSchema);
    const projectId = authenticated.auth.project.id;

    // Auto-register the server if it does not exist yet, scoped to the project.
    await db.$executeRaw`
      INSERT INTO "McpServerRegistry" ("id", "projectId", "serverName", "status", "trustLevel", "createdAt", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${projectId}, ${body.serverName}, 'ACTIVE', 'UNKNOWN', NOW(), NOW())
      ON CONFLICT ("projectId", "serverName") DO NOTHING
    `;
    const serverRows = await db.$queryRaw<ServerRow[]>`
      SELECT "id", "status" FROM "McpServerRegistry" WHERE "projectId" = ${projectId} AND "serverName" = ${body.serverName} LIMIT 1
    `;
    const server = serverRows[0];
    if (!server) return jsonResponse({ error: true, message: "MCP server could not be resolved." }, { status: 500 });

    const snapshots: McpToolSnapshot[] = [];
    const drifts: Array<Record<string, unknown>> = [];

    for (const tool of body.tools) {
      const current = snapshotTool(tool);
      snapshots.push(current);

      // Load the latest prior snapshot for this tool (project + server scoped).
      const prevRows = await db.$queryRaw<SnapshotRow[]>`
        SELECT "toolDescriptionHash", "inputSchemaHash", "outputSchemaHash", "endpointHash", "detectedCapabilitiesJson", "riskLevel", "riskReasonsJson", "toolDescriptionRedacted"
        FROM "McpToolSnapshot"
        WHERE "projectId" = ${projectId} AND "serverId" = ${server.id} AND "toolName" = ${tool.name}
        ORDER BY "createdAt" DESC LIMIT 1
      `;
      const previous: McpToolSnapshot | null = prevRows[0]
        ? {
            toolName: tool.name,
            toolDescriptionHash: prevRows[0].toolDescriptionHash,
            inputSchemaHash: prevRows[0].inputSchemaHash,
            outputSchemaHash: prevRows[0].outputSchemaHash,
            endpointHash: prevRows[0].endpointHash,
            toolDescriptionRedacted: prevRows[0].toolDescriptionRedacted ?? "",
            inputSchemaJson: {},
            outputSchemaJson: null,
            detectedCapabilities: Array.isArray(prevRows[0].detectedCapabilitiesJson) ? prevRows[0].detectedCapabilitiesJson as McpToolSnapshot["detectedCapabilities"] : [],
            riskLevel: prevRows[0].riskLevel as McpToolSnapshot["riskLevel"],
            riskReasons: Array.isArray(prevRows[0].riskReasonsJson) ? prevRows[0].riskReasonsJson as string[] : [],
            promptInjectionDetected: Array.isArray(prevRows[0].riskReasonsJson) && (prevRows[0].riskReasonsJson as string[]).some((reason) => /prompt injection/i.test(reason)),
          }
        : null;

      const snapshotId = crypto.randomUUID();
      await db.$executeRaw`
        INSERT INTO "McpToolSnapshot" ("id", "projectId", "serverId", "toolName", "toolDescriptionHash", "inputSchemaHash", "outputSchemaHash", "endpointHash", "toolDescriptionRedacted", "inputSchemaJson", "outputSchemaJson", "detectedCapabilitiesJson", "riskLevel", "riskReasonsJson", "createdAt")
        VALUES (
          ${snapshotId}, ${projectId}, ${server.id}, ${tool.name}, ${current.toolDescriptionHash}, ${current.inputSchemaHash},
          ${current.outputSchemaHash}, ${current.endpointHash}, ${current.toolDescriptionRedacted},
          ${JSON.stringify(current.inputSchemaJson)}::jsonb, ${JSON.stringify(current.outputSchemaJson)}::jsonb,
          ${JSON.stringify(current.detectedCapabilities)}::jsonb, ${current.riskLevel}, ${JSON.stringify(current.riskReasons)}::jsonb, NOW()
        )
      `;

      for (const drift of diffSnapshots(previous, current)) {
        await db.$executeRaw`
          INSERT INTO "McpToolDrift" ("id", "projectId", "serverId", "toolName", "currentSnapshotId", "driftType", "riskBefore", "riskAfter", "summary", "recommendation", "status", "createdAt", "updatedAt")
          VALUES (${crypto.randomUUID()}, ${projectId}, ${server.id}, ${tool.name}, ${snapshotId}, ${drift.driftType}, ${drift.riskBefore}, ${drift.riskAfter}, ${drift.summary}, ${drift.recommendation}, 'OPEN', NOW(), NOW())
        `;
        drifts.push({ toolName: drift.toolName, driftType: drift.driftType, riskBefore: drift.riskBefore, riskAfter: drift.riskAfter, recommendation: drift.recommendation });
      }
    }

    return jsonResponse({
      serverRiskLevel: serverRiskLevel(snapshots),
      serverStatus: server.status,
      snapshotsCreated: snapshots.length,
      drifts,
      tools: snapshots.map((snapshot) => ({ tool: snapshot.toolName, riskLevel: snapshot.riskLevel, capabilities: snapshot.detectedCapabilities, reasons: snapshot.riskReasons })),
    });
  } catch (error) {
    return routeError(error, "MCP tool snapshot could not be processed.");
  }
}
