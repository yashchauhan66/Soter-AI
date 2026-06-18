import { z } from "zod";
import { authenticateAgentFirewall, readAgentJson, routeError } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { scanMcpTools } from "@/lib/agent-firewall/mvp3";

export const dynamic = "force-dynamic";

const schema = z.object({
  serverName: z.string().trim().min(1).max(160),
  tools: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).optional(),
    inputSchema: z.unknown().optional(),
  })).max(200),
});

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, schema);
    const result = scanMcpTools(body);
    for (const tool of result.tools) {
      const source = body.tools.find((item) => item.name === tool.tool);
      await db.$executeRaw`
        INSERT INTO "McpToolScan" ("id", "projectId", "serverName", "toolName", "toolSchemaJson", "detectedCapabilitiesJson", "riskLevel", "riskReasonsJson", "recommendedPolicyJson", "createdAt")
        VALUES (${crypto.randomUUID()}, ${authenticated.auth.project.id}, ${body.serverName}, ${tool.tool}, ${JSON.stringify(source?.inputSchema ?? {})}::jsonb, ${JSON.stringify(tool.capabilities)}::jsonb, ${tool.riskLevel}, ${JSON.stringify(tool.reasons)}::jsonb, ${JSON.stringify({ recommendedDecision: tool.recommendedDecision })}::jsonb, NOW())
      `;
    }
    return jsonResponse(result);
  } catch (error) {
    return routeError(error, "MCP tools could not be scanned.");
  }
}
