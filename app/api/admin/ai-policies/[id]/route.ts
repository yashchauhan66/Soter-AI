import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { updatePolicySchema } from "@/lib/admin-ai-policies/schemas";
import { deletePolicy, updatePolicy } from "@/lib/admin-ai-policies/store";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = updatePolicySchema.parse(await readJson(request));
    const policy = await updatePolicy(body.organizationId, id, admin.id, {
      name: body.name ?? body.policyName,
      description: body.description,
      enabled: body.enabled,
      mode: body.mode,
      severity: body.severity,
      action: body.action,
      scope: body.scope,
      destinations: body.destinations,
      detectionConfig: body.detectionConfig,
      logMode: body.logMode,
    });
    if (!policy) return jsonResponse({ error: true, message: "Policy not found." }, { status: 404 });
    return jsonResponse({ policy });
  } catch (error) {
    return apiError(error, "AI policy could not be updated.");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const deleted = await deletePolicy(organizationId, id, admin.id);
    if (!deleted) return jsonResponse({ error: true, message: "Policy not found." }, { status: 404 });
    return jsonResponse({ ok: true });
  } catch (error) {
    return apiError(error, "AI policy could not be deleted.");
  }
}
