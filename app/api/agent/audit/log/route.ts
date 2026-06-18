import {
  auditLogSchema,
  authenticateAgentFirewall,
  persistExplicitAudit,
  readAgentJson,
  routeError,
} from "@/lib/agent-firewall/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, auditLogSchema);
    return persistExplicitAudit(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Agent audit log could not be saved.");
  }
}
