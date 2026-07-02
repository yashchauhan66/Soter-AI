import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { POLICY_TEMPLATES } from "@/lib/admin-ai-policies";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    return jsonResponse({ templates: POLICY_TEMPLATES });
  } catch (error) {
    return apiError(error, "AI policy templates could not be loaded.");
  }
}
