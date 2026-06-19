import {
  agentPassportIssueSchema,
  authenticateAgentPassport,
  issueAgentPassport,
  readPassportJson,
  routeError,
} from "@/lib/agent-passport/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentPassport(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readPassportJson(request, agentPassportIssueSchema);
    return issueAgentPassport(authenticated.auth, body);
  } catch (error) {
    return routeError(error, "Agent session passport could not be issued.");
  }
}
