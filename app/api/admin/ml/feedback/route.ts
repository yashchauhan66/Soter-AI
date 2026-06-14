import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { importFeedbackIntoDataset } from "@/lib/ml";

export const dynamic = "force-dynamic";

const schema = z.object({
  organizationId: z.string().min(1),
  datasetId: z.string().min(1),
  limit: z.number().min(1).max(500).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await readJson(request));
    const result = await importFeedbackIntoDataset(body);
    return jsonResponse({ added: result.added });
  } catch (error) {
    return apiError(error, "Feedback-to-dataset import failed.");
  }
}
