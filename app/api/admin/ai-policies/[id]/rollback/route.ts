import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { rollbackPolicySchema } from "@/lib/admin-ai-policies/schemas";
import { rollbackPolicy } from "@/lib/admin-ai-policies/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = rollbackPolicySchema.parse(await readJson(request));
    const policy = await rollbackPolicy(body.organizationId, id, body.version, admin.id);
    if (!policy) return jsonResponse({ error: true, message: "Policy version not found." }, { status: 404 });
    return jsonResponse({ policy });
  } catch (error) {
    return apiError(error, "AI policy rollback could not be completed.");
  }
}
