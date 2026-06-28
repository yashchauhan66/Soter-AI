import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { scanMcpServerRisk } from "@/lib/mcp-risk-scanner";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

const schema = z.object({
  serverName: z.string().trim().min(1).max(160),
  serverUrl: z.string().trim().max(500).optional(),
  repositoryUrl: z.string().trim().max(500).optional(),
  tools: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4000).optional(),
    inputSchema: z.unknown().optional(),
    outputSchema: z.unknown().optional(),
    endpoint: z.string().trim().max(500).optional(),
  })).min(1).max(100),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rateLimited = await enforcePublicRateLimit({
      request,
      scope: "mcp-risk-scan",
      limit: 20,
      windowMs: 60_000,
      message: "Too many MCP risk scans. Please try again later.",
    });
    if (rateLimited) return rateLimited;

    const body = schema.parse(await readJson(request));
    const result = scanMcpServerRisk(body);
    return jsonResponse(result, {
      status: result.riskLevel === "CRITICAL" ? 422 : 200,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return apiError(error, "MCP risk scan could not be completed.");
  }
}
