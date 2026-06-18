import { z } from "zod";
import { authenticateAgentFirewall, readAgentJson, routeError } from "@/lib/agent-firewall/server";
import { jsonResponse } from "@/lib/apiResponse";
import { checkBrowserForm } from "@/lib/agent-firewall/mvp3";

export const dynamic = "force-dynamic";

const schema = z.object({
  sessionId: z.string().trim().max(200).optional(),
  url: z.string().trim().max(2000).optional(),
  domain: z.string().trim().max(300).optional(),
  formFields: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    value: z.string().max(5000).optional(),
    type: z.string().trim().max(100).optional(),
  })).max(200),
  pageText: z.string().max(20_000).optional(),
  destination: z.enum(["external", "internal", "local", "unknown"]).default("external"),
});

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateAgentFirewall(request);
    if (!authenticated.ok) return authenticated.response;
    const body = await readAgentJson(request, schema);
    return jsonResponse(checkBrowserForm(body));
  } catch (error) {
    return routeError(error, "Browser form could not be checked.");
  }
}
