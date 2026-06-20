import { z } from "zod";
import { authenticateAgentFirewall, readAgentJson, routeError } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.string().trim().max(5000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;

    const body = await readAgentJson(request, schema);
    const canaryId = (await context.params).id;

    // Fail-closed: must belong to this tenant/project
    const result = await db.$executeRaw`
      UPDATE "CanaryToken"
      SET "active" = false
      WHERE "projectId" = ${authenticated.auth.project.id} AND "id" = ${canaryId}
    `;

    // executeRaw returns number; Prisma $executeRaw can vary between drivers.
    // We only treat "0" as not found.
    if (result === 0) {
      return jsonResponse({ ok: false, error: "Canary token not found for this project." }, { status: 404 } as any);
    }

    return jsonResponse({
      ok: true,
      id: canaryId,
      disabledReason: body.reason ?? null,
    });
  } catch (error) {
    return routeError(error, "Canary token could not be disabled.");
  }
}
