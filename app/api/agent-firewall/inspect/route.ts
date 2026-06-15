import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { inspectToolCall, TOOL_CATEGORIES } from "@/lib/agent-firewall";

const schema = z.object({
  projectId: z.string().min(1),
  tool: z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(120),
    category: z.enum(TOOL_CATEGORIES),
    enabled: z.boolean().default(false),
  }).optional(),
  permission: z.object({
    allow: z.boolean(),
    requiresApproval: z.boolean().optional(),
  }).nullable().optional(),
  action: z.string().min(1).max(200),
  input: z.record(z.unknown()).optional(),
  highRiskPromptContext: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    await requireProjectPermission(body.projectId, "policy:manage");
    return jsonResponse(inspectToolCall(body));
  } catch (error) {
    return apiError(error, "Tool call could not be inspected.");
  }
}
