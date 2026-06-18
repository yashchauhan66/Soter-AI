import { z } from "zod";
import { authenticateAgentFirewall, readAgentJson, routeError } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { checkMemory } from "@/lib/agent-firewall/mvp3";

export const dynamic = "force-dynamic";

const schema = z.object({
  sessionId: z.string().trim().max(200).optional(),
  memoryAction: z.enum(["STORE", "READ", "UPDATE", "DELETE"]),
  content: z.string().max(20_000).optional(),
  memoryType: z.string().trim().max(120).default("custom"),
});

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, schema);
    const result = checkMemory(body);
    await db.$executeRaw`
      INSERT INTO "AgentMemoryEvent" ("id", "sessionId", "projectId", "memoryType", "action", "decision", "riskLevel", "contentRedacted", "reason", "createdAt")
      VALUES (${crypto.randomUUID()}, ${body.sessionId ?? null}, ${authenticated.auth.project.id}, ${body.memoryType}, ${body.memoryAction}, ${result.decision}, ${result.riskLevel}, ${result.safeContent ?? null}, ${result.reason}, NOW())
    `;
    return jsonResponse(result);
  } catch (error) {
    return routeError(error, "Agent memory could not be checked.");
  }
}
