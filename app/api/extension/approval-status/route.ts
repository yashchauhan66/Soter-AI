import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { authenticateExtensionRequest } from "../_shared";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const statusRequestSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  employeeId: z.string().trim().max(200),
  approvalId: z.string().trim().min(1).max(100),
});

/**
 * POST /api/extension/approval-status
 * Check status of an approval request
 */
export async function POST(request: Request) {
  try {
    const body = statusRequestSchema.parse(await readJson(request));
    const auth = await authenticateExtensionRequest(request, body.organizationId);
    if (!auth.ok) return auth.response;

    const approvalEvent = await db.securityEvent.findFirst({
      where: {
        organizationId: body.organizationId,
        eventType: "EXTENSION_APPROVAL_REQUEST",
        metadata: { path: ["approvalId"], equals: body.approvalId },
      },
      select: {
        id: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (!approvalEvent) {
      return jsonResponse({ error: true, message: "Approval request not found." }, { status: 404 });
    }

    const metadata = approvalEvent.metadata && typeof approvalEvent.metadata === "object" ? approvalEvent.metadata as Record<string, unknown> : {};
    const status = String(metadata.status ?? "PENDING");

    return jsonResponse({
      approvalId: body.approvalId,
      status,
      reviewedAt: typeof metadata.reviewedAt === "string" ? metadata.reviewedAt : null,
      reviewedBy: typeof metadata.reviewedBy === "string" ? metadata.reviewedBy : null,
      reviewerComment: typeof metadata.reviewerComment === "string" ? metadata.reviewerComment : null,
      expiresAt: typeof metadata.expiresAt === "string" ? metadata.expiresAt : null,
      createdAt: approvalEvent.createdAt.toISOString(),
    });
  } catch (error) {
    return apiError(error, "Failed to fetch approval status");
  }
}
