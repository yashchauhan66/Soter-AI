import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getCurrentProjectById } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ensureCustomerOnboarding, ONBOARDING_STEPS, recordOnboardingStep } from "@/lib/ops/onboarding";

const bodySchema = z.object({
  type: z.enum(["BETA", "AGENCY", "ENTERPRISE"]).default("BETA"),
  projectId: z.string().optional(),
  stepKey: z.enum(ONBOARDING_STEPS),
  state: z.enum(["COMPLETED", "SKIPPED"]),
  metadata: z.record(z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
});

export async function GET(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 404 });
    const type = new URL(request.url).searchParams.get("type") as "BETA" | "AGENCY" | "ENTERPRISE" | null;
    const project = await getCurrentProjectById(new URL(request.url).searchParams.get("projectId") ?? undefined);
    const onboarding = await ensureCustomerOnboarding({ organizationId: active.org.id, userId: active.membership.userId, projectId: project.id, type: type ?? "BETA" });
    return jsonResponse(onboarding);
  } catch (error) { return apiError(error, "Onboarding could not be loaded."); }
}

export async function PATCH(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 404 });
    const project = await getCurrentProjectById(body.projectId);
    const onboarding = await ensureCustomerOnboarding({ organizationId: active.org.id, userId: active.membership.userId, projectId: project.id, type: body.type });
    const event = await recordOnboardingStep({ onboardingId: onboarding.id, stepKey: body.stepKey, state: body.state, metadata: body.metadata });
    await db.organizationAuditLog.create({ data: { organizationId: active.org.id, actorUserId: active.membership.userId, action: `onboarding.${body.state.toLowerCase()}`, category: "ONBOARDING", metadata: { stepKey: body.stepKey, type: body.type } } });
    return jsonResponse(event);
  } catch (error) { return apiError(error, "Onboarding step could not be updated."); }
}
