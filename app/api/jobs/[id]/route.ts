import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { findBackgroundJob } from "@/lib/backgroundJobs";
import { eventStoreFlags, listWorkerTaskEvents } from "@/lib/events/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const job = await findBackgroundJob(id);
    if (!job) return jsonResponse({ error: true, message: "Job not found." }, { status: 404 });
    const events = eventStoreFlags().enabled
      ? await listWorkerTaskEvents(id, { limit: 50 }).catch((error) => {
          console.error("[SoterAI] Worker event history read failed", error);
          return { items: [], nextCursor: null };
        })
      : { items: [], nextCursor: null };
    return jsonResponse({ ...job, events: events.items, eventsNextCursor: events.nextCursor });
  } catch (error) {
    return apiError(error, "Background job could not be loaded.");
  }
}
