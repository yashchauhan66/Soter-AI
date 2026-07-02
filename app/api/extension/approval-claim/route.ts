import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { db } from "@/lib/db";
import { evaluateApprovalClaim, claimedApprovalMetadata, type ApprovalClaimMetadata } from "@/lib/extension/approvalClaims";
import { checkRateLimit } from "@/lib/extension/rateLimiter";

export const dynamic = "force-dynamic";

const claimSchema = z.object({
  requestId: z.string().trim().min(1).max(200),
  organizationId: z.string().trim().min(1).max(200),
  employeeId: z.string().trim().max(200).optional(),
  deviceId: z.string().trim().max(200).optional(),
  destination: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const body = claimSchema.parse(await readJson(request));

    // Find the approval request (stored as AgentApproval or security event metadata)
    const approval = await db.agentApproval.findUnique({ where: { id: body.requestId } });
    if (!approval) {
      return jsonResponse({ error: true, message: "Approval request not found." }, { status: 404 });
    }

    // Scope check: must match organization
    if (approval.projectId) {
      const project = await db.project.findUnique({ where: { id: approval.projectId }, select: { organizationId: true } });
      if (project && project.organizationId !== body.organizationId) {
        return jsonResponse({ error: true, message: "Approval request does not belong to this organization." }, { status: 403 });
      }
    }

    // Evaluate claim using existing library
    // Use safeContent field for metadata (not requestedContentRedacted which holds prompt text)
    const metadata: ApprovalClaimMetadata = (typeof approval.safeContent === "string"
      ? (() => { try { return JSON.parse(approval.safeContent!); } catch { return {}; } })()
      : {}) as ApprovalClaimMetadata;

    // Check approval status from AgentApproval fields
    const resolvedMeta: ApprovalClaimMetadata = {
      ...metadata,
      resolved: approval.status === "APPROVED" || approval.status === "DENIED",
      resolution: approval.status === "APPROVED" ? "approved" : approval.status === "DENIED" ? "rejected" : undefined,
      organizationId: body.organizationId,
      employeeId: metadata.employeeId ?? body.employeeId,
      deviceId: metadata.deviceId ?? body.deviceId,
      expiresAt: approval.expiresAt.toISOString(),
    };

    const evaluation = evaluateApprovalClaim({
      metadata: resolvedMeta,
      employeeId: body.employeeId,
      deviceId: body.deviceId,
      organizationId: body.organizationId,
      destination: body.destination,
    });

    if (!evaluation.allowed) {
      // Audit the failed claim
      await db.securityEvent.create({
        data: {
          organizationId: body.organizationId,
          eventType: "APPROVAL_CLAIM_DENIED",
          severity: "LOW",
          riskTypes: [evaluation.status],
          action: "DENY",
          source: "extension.approval-claim",
          metadata: {
            requestId: body.requestId,
            employeeId: body.employeeId ?? null,
            deviceId: body.deviceId ?? null,
            destination: body.destination,
            reason: evaluation.status,
          },
        },
      });

      return jsonResponse({ allowed: false, status: evaluation.status }, { status: 403 });
    }

    // Check if "once" approval was already claimed
    const isOnceApproval = (metadata.duration ?? "once") === "once";
    if (isOnceApproval && metadata.claimedAt) {
      return jsonResponse({ allowed: false, status: "already_claimed" }, { status: 409 });
    }

    // For "once" approval: update the approval request to mark as claimed
    if (isOnceApproval) {
      const updatedMetadata = claimedApprovalMetadata(resolvedMeta, {
        metadata: resolvedMeta,
        employeeId: body.employeeId,
        deviceId: body.deviceId,
        organizationId: body.organizationId,
        destination: body.destination,
      });

      await db.agentApproval.update({
        where: { id: body.requestId },
        data: {
          safeContent: JSON.stringify(updatedMetadata),
        },
      });
    }

    // Audit the successful claim
    await db.securityEvent.create({
      data: {
        organizationId: body.organizationId,
        eventType: "APPROVAL_CLAIMED",
        severity: "INFO",
        riskTypes: [],
        action: "APPROVE",
        source: "extension.approval-claim",
        metadata: {
          requestId: body.requestId,
          employeeId: body.employeeId ?? null,
          deviceId: body.deviceId ?? null,
          destination: body.destination,
          duration: metadata.duration ?? "once",
        },
      },
    });

    return jsonResponse({
      allowed: true,
      status: "approved",
      redactedPrompt: evaluation.redactedPrompt ?? null,
      duration: metadata.duration ?? "once",
    });
  } catch (error) {
    return apiError(error, "Approval claim could not be processed.");
  }
}
