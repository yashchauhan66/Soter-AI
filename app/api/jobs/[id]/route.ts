import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { findBackgroundJob } from "@/lib/backgroundJobs";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const job = await findBackgroundJob(id);
    if (!job) return jsonResponse({ error: true, message: "Job not found." }, { status: 404 });
    return jsonResponse(job);
  } catch (error) {
    return apiError(error, "Background job could not be loaded.");
  }
}
