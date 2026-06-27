import { Prisma } from "@prisma/client";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { z } from "zod";
import { emitSecurityEvent } from "@/lib/events/emit";
import { invalidateProjectPolicyCache } from "@/lib/guard/policy";

export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  projectId: z.string().min(1),
  mode: z.enum(["MONITOR", "BALANCED", "STRICT"]).optional(),
  blockPromptInjection: z.boolean().optional(),
  blockJailbreak: z.boolean().optional(),
  redactPII: z.boolean().optional(),
  redactIndiaPII: z.boolean().optional(),
  blockSecrets: z.boolean().optional(),
  blockSystemPromptLeak: z.boolean().optional(),
  unsafeOutputMode: z.enum(["WARN", "REDACT", "BLOCK"]).optional(),
  customBlockedTopics: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  allowlistedDomains: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  deniedPatterns: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
  customFallbackMessage: z.string().trim().max(500).optional().or(z.literal("")),
  riskThresholds: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
  citationRequired: z.boolean().optional(),
  noSourceFallback: z.string().trim().max(500).optional().or(z.literal("")),
  highRiskTopicReview: z.boolean().optional(),
  minSourceCount: z.number().int().min(0).max(20).optional(),
  requireSourceUrls: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const projectId = params.get("projectId");
    if (!projectId) return jsonResponse({ error: true, message: "projectId required." }, { status: 400 });
    await requireProjectPermission(projectId, "policy:manage");
    const policy = await db.projectPolicy.findUnique({ where: { projectId } });
    return jsonResponse(policy ?? null);
  } catch (error) { return apiError(error, "Policy could not be loaded."); }
}

export async function PUT(request: Request) {
  try {
    const body = upsertSchema.parse(await readJson(request));
    const access = await requireProjectPermission(body.projectId, "policy:manage");
    const data = {
      mode: body.mode ?? "BALANCED",
      blockPromptInjection: body.blockPromptInjection ?? true,
      blockJailbreak: body.blockJailbreak ?? true,
      redactPII: body.redactPII ?? true,
      redactIndiaPII: body.redactIndiaPII ?? true,
      blockSecrets: body.blockSecrets ?? true,
      blockSystemPromptLeak: body.blockSystemPromptLeak ?? true,
      unsafeOutputMode: body.unsafeOutputMode ?? "BLOCK",
      customBlockedTopics: body.customBlockedTopics ?? [],
      allowlistedDomains: body.allowlistedDomains ?? [],
      deniedPatterns: body.deniedPatterns ?? [],
      customFallbackMessage: body.customFallbackMessage || null,
      riskThresholds: body.riskThresholds ?? Prisma.JsonNull,
      citationRequired: body.citationRequired ?? false,
      noSourceFallback: body.noSourceFallback || null,
      highRiskTopicReview: body.highRiskTopicReview ?? true,
      minSourceCount: body.minSourceCount ?? 1,
      requireSourceUrls: body.requireSourceUrls ?? false,
    } as const;
    const policy = await db.projectPolicy.upsert({
      where: { projectId: body.projectId },
      create: { projectId: body.projectId, ...data },
      update: data,
    });
    await invalidateProjectPolicyCache(body.projectId);
    await emitSecurityEvent({ organizationId: access.org.id, projectId: access.project.id, eventType: "policy.changed", severity: "MEDIUM", riskTypes: [], action: "UPDATED", source: "api.projects.policy", metadata: { mode: policy.mode, citationRequired: policy.citationRequired, minSourceCount: policy.minSourceCount } });
    return jsonResponse(policy);
  } catch (error) { return apiError(error, "Policy could not be saved."); }
}
