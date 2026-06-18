import { z } from "zod";
import { authenticateAgentFirewall, readAgentJson, routeError } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { createCanary } from "@/lib/agent-firewall/mvp3";

export const dynamic = "force-dynamic";

const schema = z.object({
  scope: z.enum(["SYSTEM_PROMPT", "RAG_CONTEXT", "TOOL_OUTPUT", "PRIVATE_CONTEXT"]),
  label: z.string().trim().max(160).optional(),
});

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, schema);
    const canary = createCanary(body);
    await db.$executeRaw`
      INSERT INTO "CanaryToken" ("id", "projectId", "tokenHash", "tokenLabel", "scope", "active", "createdAt")
      VALUES (${crypto.randomUUID()}, ${authenticated.auth.project.id}, ${canary.tokenHash}, ${canary.tokenLabel}, ${canary.scope}, true, NOW())
    `;
    return jsonResponse({
      canaryToken: canary.canaryToken,
      instructions: canary.instructions,
      tokenLabel: canary.tokenLabel,
      scope: canary.scope,
    });
  } catch (error) {
    return routeError(error, "Canary token could not be created.");
  }
}
