import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { inspectToolCall, TOOL_CATEGORIES } from "@/lib/agent-firewall";
import { runInputGuard } from "@/lib/guard/inputGuard";
import { augmentWithMl } from "@/lib/guard/mlAugment";

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
    const inspection = inspectToolCall(body);
    // WS1.1: ML recall pass over the serialised tool call. Shadow mode records
    // metadata only; enforce mode escalates an ALLOW to APPROVAL_REQUIRED so a
    // novel attack the rules missed still lands in the human approval queue.
    const toolCallText = `${body.tool?.name ?? ""} ${body.action} ${JSON.stringify(body.input ?? {})}`.slice(0, 20_000);
    const mlChecked = await augmentWithMl(runInputGuard(toolCallText), toolCallText, "INPUT");
    const ml = (mlChecked.metadata as Record<string, unknown> | undefined)?.ml;
    if (mlChecked.action === "HUMAN_REVIEW" && inspection.decision === "ALLOW") {
      return jsonResponse({
        ...inspection,
        decision: "APPROVAL_REQUIRED",
        reason: `${inspection.reason} ML anomaly detected — held for human approval.`,
        ml,
      });
    }
    return jsonResponse({ ...inspection, ml });
  } catch (error) {
    return apiError(error, "Tool call could not be inspected.");
  }
}
