import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export async function POST(request: Request) {
  try {
    const body = z.object({ guardLogId: z.string().min(1), feedback: z.enum(["FALSE_POSITIVE", "FALSE_NEGATIVE", "CORRECT"]), note: z.string().trim().max(500).optional() }).parse(await readJson(request));
    const log = await db.guardLog.findUnique({ where: { id: body.guardLogId }, include: { project: true } });
    if (!log) return jsonResponse({ error: true, message: "Guard log not found." }, { status: 404 });
    const access = await requireProjectPermission(log.projectId, "feedback:create");
    const safeNote = body.note ? sanitizeLogText(body.note) : undefined;
    const feedback = await db.detectionFeedback.upsert({ where: { guardLogId_createdById: { guardLogId: log.id, createdById: access.user.id } }, create: { organizationId: access.org.id, projectId: log.projectId, guardLogId: log.id, feedback: body.feedback, note: safeNote, createdById: access.user.id }, update: { feedback: body.feedback, note: safeNote } });
    await db.feedbackReview.upsert({ where: { detectionFeedbackId: feedback.id }, create: { detectionFeedbackId: feedback.id }, update: { status: "PENDING", reviewedAt: null } });
    return jsonResponse(feedback, { status: 201 });
  } catch (error) { return apiError(error, "Feedback could not be saved."); }
}
