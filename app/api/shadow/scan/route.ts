import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { runShadowScan, getShadowAiSummary } from "@/lib/shadow-ai";

const scanSchema = z.object({
  projectId: z.string().optional(),
  scanType: z.string().default("FULL"),
  codeSnippets: z.array(z.string()).optional(),
  packageJson: z.record(z.unknown()).optional(),
  envKeys: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = scanSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId ?? "", "shadow_ai:scan");
    const result = await runShadowScan({
      organizationId: access.org.id,
      projectId: access.project.id,
      scanType: body.scanType,
      codeSnippets: body.codeSnippets,
      packageJson: body.packageJson,
      envKeys: body.envKeys,
    });
    return jsonResponse(result);
  } catch (error) {
    return apiError(error, "Shadow scan could not be completed.");
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return jsonResponse({ error: true, message: "projectId is required." }, { status: 400 });
    const access = await requireProjectPermission(projectId, "policy:manage");
    const summary = await getShadowAiSummary(access.org.id);
    return jsonResponse(summary);
  } catch (error) {
    return apiError(error, "Could not fetch shadow AI summary.");
  }
}
