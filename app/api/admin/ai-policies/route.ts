import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { createPolicySchema } from "@/lib/admin-ai-policies/schemas";
import { createPolicy, listPolicies, listPolicyAuditLogs, listPolicyVersions } from "@/lib/admin-ai-policies/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) return jsonResponse({ error: true, message: "organizationId required." }, { status: 400 });
    const [policies, versions, auditLogs] = await Promise.all([
      listPolicies(organizationId),
      listPolicyVersions(organizationId),
      listPolicyAuditLogs(organizationId),
    ]);
    return jsonResponse({ policies, versions, auditLogs });
  } catch (error) {
    return apiError(error, "AI policies could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = createPolicySchema.parse(await readJson(request));
    const policy = await createPolicy({
      organizationId: body.organizationId,
      actorId: admin.id,
      templateKey: body.templateKey,
      policy: body.templateKey ? undefined : {
        name: body.name ?? body.policyName ?? "Untitled policy",
        description: body.description,
        enabled: body.enabled,
        mode: body.mode,
        severity: body.severity,
        action: body.action,
        scope: body.scope,
        destinations: body.destinations,
        detectionConfig: body.detectionConfig,
        logMode: body.logMode,
      },
    });
    return jsonResponse({ policy }, { status: 201 });
  } catch (error) {
    return apiError(error, "AI policy could not be created.");
  }
}
