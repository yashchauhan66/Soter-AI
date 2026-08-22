import { apiError, jsonResponse } from "@/lib/apiResponse";
import { checkRateLimit } from "@/lib/extension/rateLimiter";
import { db } from "@/lib/db";
import { authenticateExtensionRequest } from "../../_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/extension/approval-status/[requestId]?organizationId=...
 *
 * AUTH: this was the one route of the seventeen under /api/extension that had
 * no authentication, no rate limit and no ownership check -- it took a caller
 * supplied id straight into `findUnique` and returned the approval's status and
 * reason to anyone. It went unnoticed because the NextAuth middleware was
 * session-gating the whole prefix, so every caller got 401 before the handler
 * ran: the route was broken, which looked the same from outside as protected.
 * Adding /api/extension to PUBLIC_API_PREFIXES (so the extension, which holds a
 * device token and no session cookie, can reach its control plane at all) is
 * what would have turned that into a live cross-tenant read.
 *
 * So it now authenticates the way its sixteen siblings do. The order matters:
 * rate limit, then authenticate, then look anything up. Querying before the
 * token is checked would leave an unauthenticated caller a 404-vs-200 oracle
 * for guessed ids and an unbounded database probe. `organizationId` is required
 * for the same reason the sibling POST /approval-status requires it in its body
 * -- authenticateExtensionRequest binds the credential to one organization, and
 * without a claimed org there is nothing to bind it against.
 */
export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { requestId } = await params;
    const organizationId = new URL(request.url).searchParams.get("organizationId")?.trim();
    if (!organizationId) {
      return jsonResponse({ error: true, message: "organizationId is required." }, { status: 400 });
    }

    // Keyed on org *and* IP: organizationId arrives from the caller, so an org
    // key on its own is trivially rotated to get a fresh bucket.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateLimit = await checkRateLimit("approval-status", organizationId, { ip });
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: true, message: "Too many approval-status requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } },
      );
    }

    const auth = await authenticateExtensionRequest(request, organizationId);
    if (!auth.ok) return auth.response;

    const approval = await db.agentApproval.findUnique({
      where: { id: requestId },
      select: {
        id: true, projectId: true, status: true, reason: true,
        expiresAt: true, createdAt: true, resolvedAt: true, safeContent: true,
      },
    });

    // AgentApproval carries projectId with no relation to Project, so ownership
    // costs a second lookup rather than a join. A cross-organization hit answers
    // 404, identically to a nonexistent id: a 403 would confirm that the id is
    // real and belongs to someone else, which is the fact worth withholding.
    const owner = approval
      ? await db.project.findUnique({ where: { id: approval.projectId }, select: { organizationId: true } })
      : null;
    if (!approval || owner?.organizationId !== organizationId) {
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
