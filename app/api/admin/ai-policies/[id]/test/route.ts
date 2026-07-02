import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { testPolicySchema } from "@/lib/admin-ai-policies/schemas";
import { getPolicy, recordPolicyAudit } from "@/lib/admin-ai-policies/store";
import { testPolicy } from "@/lib/admin-ai-policies";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = testPolicySchema.parse(await readJson(request));
    const policy = await getPolicy(body.organizationId, id);
    if (!policy) return jsonResponse({ error: true, message: "Policy not found." }, { status: 404 });
    const result = testPolicy({
      policy,
      sampleText: body.sampleText,
      destinationDomain: body.destinationDomain,
      department: body.department,
      role: body.role,
      userId: body.userId,
      fileName: body.fileName,
    });
    await recordPolicyAudit({
      organizationId: body.organizationId,
      adminUserId: admin.id,
      action: "TEST",
      policyId: id,
      after: {
        matched: result.matched,
        matchedRules: result.matchedRules,
        action: result.action,
        severity: result.severity,
        storedSample: body.storeSample,
        samplePreview: body.storeSample ? result.redactedOutput.slice(0, 1000) : undefined,
      },
    });
    return jsonResponse({ result });
  } catch (error) {
    return apiError(error, "AI policy test could not be run.");
  }
}
