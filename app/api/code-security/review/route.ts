import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateApiKeyRequest } from "@/lib/apiKeyMiddleware";
import { requireProjectPermission } from "@/lib/auth/guards";
import { reviewCodeSecurity } from "@/lib/code-security";

const schema = z.object({
  projectId: z.string().trim().min(1).optional(),
  code: z.string().min(1, "Code or a unified diff is required.").max(24_000),
  filename: z.string().trim().max(240).optional(),
  language: z.string().trim().max(40).optional(),
  context: z.object({
    environment: z.enum(["development", "staging", "production"]).optional(),
    internetExposed: z.boolean().optional(),
    handlesSensitiveData: z.boolean().optional(),
    containsAuthCode: z.boolean().optional(),
    aiGenerated: z.boolean().optional(),
  }).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const hasApiKey = Boolean(request.headers.get("x-api-key"));

    if (hasApiKey) {
      const authenticated = await authenticateApiKeyRequest(request);
      if (!authenticated.ok) return authenticated.response;
      if (body.projectId && body.projectId !== authenticated.auth.project.id) {
        return jsonResponse({ error: true, message: "The API key does not belong to the requested project." }, { status: 403 });
      }
    } else {
      if (!body.projectId) return jsonResponse({ error: true, message: "projectId is required for dashboard reviews." }, { status: 400 });
      await requireProjectPermission(body.projectId, "project:read");
    }

    const result = reviewCodeSecurity(body);
    return jsonResponse(result, {
      status: 200,
      headers: {
        "X-SoterAI-Review-Decision": result.decision,
        "X-SoterAI-Content-Stored": "false",
      },
    });
  } catch (error) {
    return apiError(error, "Code security review could not be completed.");
  }
}
