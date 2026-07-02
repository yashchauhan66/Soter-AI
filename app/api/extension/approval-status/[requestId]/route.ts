import { apiError, jsonResponse } from "@/lib/apiResponse";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await params;

    const approval = await db.agentApproval.findUnique({
      where: { id: requestId },
      select: {
        id: true, projectId: true, status: true, reason: true,
        expiresAt: true, createdAt: true, resolvedAt: true, safeContent: true,
      },
    });

    if (!approval) {
      return jsonResponse({ error: true, message: "Approval request not found." }, { status: 404 });
    }

    // Check expiry
    const isExpired = approval.expiresAt.getTime() <= Date.now();

    // Check if once-claim was used
    let claimed = false;
    if (approval.status === "APPROVED" && approval.safeContent) {
      try {
        const meta = JSON.parse(approval.safeContent);
        claimed = !!meta.claimedAt;
      } catch {
        // Not JSON metadata
      }
    }

    let statusLabel: string;
    if (approval.status === "APPROVED" && claimed) {
      statusLabel = "claimed";
    } else if (approval.status === "APPROVED" && isExpired) {
      statusLabel = "expired";
    } else if (approval.status === "DENIED") {
      statusLabel = "rejected";
    } else if (isExpired) {
      statusLabel = "expired";
    } else if (approval.status === "PENDING") {
      statusLabel = "pending";
    } else {
      statusLabel = approval.status.toLowerCase();
    }

    return jsonResponse({
      requestId: approval.id,
      status: statusLabel,
      reason: approval.reason,
      expiresAt: approval.expiresAt.toISOString(),
      createdAt: approval.createdAt.toISOString(),
      resolvedAt: approval.resolvedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return apiError(error, "Approval status could not be loaded.");
  }
}
