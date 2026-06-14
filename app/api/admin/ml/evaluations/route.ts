import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueBackgroundJob, jobAcceptedResponse } from "@/lib/backgroundJobs";

export const dynamic = "force-dynamic";

const schema = z.object({
  modelVersionId: z.string().min(1),
  datasetId: z.string().min(1),
  backend: z.enum(["heuristic", "default"]).default("default"),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await readJson(request));
    const [model, dataset] = await Promise.all([
      db.mLModelVersion.findUnique({ where: { id: body.modelVersionId } }),
      db.mLDataset.findUnique({ where: { id: body.datasetId } }),
    ]);
    if (!model || !dataset) {
      return jsonResponse({ error: true, message: "Model version or dataset not found." }, { status: 404 });
    }
    if (model.organizationId !== dataset.organizationId) {
      return jsonResponse({ error: true, message: "Model and dataset must belong to the same organization." }, { status: 403 });
    }
    const job = await enqueueBackgroundJob({
      type: "ML_EVALUATION",
      dedupeKey: `ml-evaluation:${body.modelVersionId}:${body.datasetId}:${body.backend}`,
      payload: { modelVersionId: body.modelVersionId, datasetId: body.datasetId, backend: body.backend },
    });
    return jsonResponse(jobAcceptedResponse(job, { modelVersionId: model.id, datasetId: dataset.id }), { status: 202 });
  } catch (error) {
    return apiError(error, "Evaluation failed.");
  }
}
