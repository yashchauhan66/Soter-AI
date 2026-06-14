import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { appendExamples } from "@/lib/ml";

export const dynamic = "force-dynamic";

const resolveSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  notes: z.string().max(2000).optional(),
  pushToDatasetId: z.string().min(1).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const body = resolveSchema.parse(await readJson(request));
    const item = await db.mLReviewQueue.findUnique({ where: { id } });
    if (!item) return jsonResponse({ error: true, message: "Review item not found." }, { status: 404 });
    if (item.status !== "PENDING") return jsonResponse({ error: true, message: "Review item already resolved." }, { status: 409 });

    if (body.pushToDatasetId && body.status === "RESOLVED") {
      const dataset = await db.mLDataset.findUnique({ where: { id: body.pushToDatasetId } });
      if (!dataset || dataset.organizationId !== item.organizationId) {
        return jsonResponse({ error: true, message: "Target dataset not in same organization." }, { status: 403 });
      }
      await appendExamples(dataset.id, [
        { text: item.redactedText, label: item.expectedLabel, language: "en", source: "review-queue" },
      ]);
    }

    const updated = await db.mLReviewQueue.update({
      where: { id: item.id },
      data: { status: body.status, notes: body.notes, resolvedById: user.id, resolvedAt: new Date() },
    });
    await db.adminAuditLog.create({
      data: {
        organizationId: item.organizationId,
        adminUserId: user.id,
        action: "ml_review_resolved",
        targetType: "ml_review_queue",
        targetId: item.id,
        reason: `${body.status}${body.pushToDatasetId ? " + pushed to dataset" : ""}`,
        metadata: { status: body.status, pushToDatasetId: body.pushToDatasetId ?? null },
      },
    });
    return jsonResponse({ id: updated.id, status: updated.status });
  } catch (error) {
    return apiError(error, "Could not update review item.");
  }
}
