import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";

const schema = z.object({ feedbackId: z.string(), status: z.enum(["ACCEPTED", "REJECTED", "NEEDS_MORE_INFO"]), redactedExample: z.string().max(5000).optional(), datasetVersion: z.string().max(80).optional(), detector: z.string().max(100).optional(), thresholdSuggestion: z.number().min(0).max(1).optional(), tuningSuggestion: z.string().max(1000).optional() });

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = schema.parse(await readJson(request));
    const feedback = await db.detectionFeedback.findUnique({ where: { id: body.feedbackId } });
    if (!feedback) return jsonResponse({ error: true, message: "Feedback not found." }, { status: 404 });
    const redactedExample = body.redactedExample ? sanitizeLogText(body.redactedExample) : undefined;
    const review = await db.feedbackReview.upsert({
      where: { detectionFeedbackId: feedback.id },
      create: { detectionFeedbackId: feedback.id, reviewerId: admin.id, status: body.status, redactedExample, datasetVersion: body.datasetVersion, detector: body.detector, thresholdSuggestion: body.thresholdSuggestion, tuningSuggestion: body.tuningSuggestion, reviewedAt: new Date() },
      update: { reviewerId: admin.id, status: body.status, redactedExample, datasetVersion: body.datasetVersion, detector: body.detector, thresholdSuggestion: body.thresholdSuggestion, tuningSuggestion: body.tuningSuggestion, reviewedAt: new Date() },
    });
    if (body.status === "ACCEPTED" && redactedExample && body.datasetVersion) {
      const dataset = await db.classifierDataset.findFirst({ where: { organizationId: feedback.organizationId, version: body.datasetVersion } });
      if (dataset) {
        await db.classifierExample.create({ data: { datasetId: dataset.id, text: redactedExample, label: feedback.feedback === "FALSE_NEGATIVE" ? "unsafe" : "safe", language: "unknown", metadata: { source: "customer_feedback", feedbackId: feedback.id, redacted: true } } });
      }
    }
    await db.adminAuditLog.create({ data: { adminUserId: admin.id, organizationId: feedback.organizationId, action: "feedback.reviewed", targetType: "DetectionFeedback", targetId: feedback.id, reason: `Feedback marked ${body.status}`, metadata: { datasetVersion: body.datasetVersion, detector: body.detector } } });
    return jsonResponse(review);
  } catch (error) { return apiError(error, "Feedback review could not be saved."); }
}
