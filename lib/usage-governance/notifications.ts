// SECURITY: Governance enforcement notification dispatcher.
// Sends webhooks and/or email notifications when governance policy blocks or
// requires approval for an AI provider access attempt.
//
// Notifications respect the policy's notifyOnBlocked and notifyOnApprovalRequest
// flags so companies can control alert verbosity.

import { db } from "../db";
import { enqueueWebhook } from "../webhooks/delivery";
import { sendTemplateEmail } from "../email/send";

export interface GovernanceEnforcementEvent {
  organizationId: string;
  projectId: string;
  providerName: string;
  modelName?: string | null;
  enforcementAction: "BLOCK" | "REQUIRE_APPROVAL";
  reason: string;
  userId?: string | null;
}

/**
 * Dispatch notifications for a governance enforcement event.
 *
 * Checks the policy's notification flags before sending:
 * - notifyOnBlocked → webhooks + email for BLOCK events
 * - notifyOnApprovalRequest → webhooks + email for REQUIRE_APPROVAL events
 *
 * Both channels are fire-and-forget (void) to avoid adding latency to
 * the API response path.
 */
export async function dispatchGovernanceEnforcement(event: GovernanceEnforcementEvent) {
  try {
    const policy = await db.aiUsageGovernancePolicy.findFirst({
      where: { organizationId: event.organizationId, enabled: true },
    });

    if (!policy) return;

    const shouldNotify =
      event.enforcementAction === "BLOCK"
        ? policy.notifyOnBlocked
        : event.enforcementAction === "REQUIRE_APPROVAL"
          ? policy.notifyOnApprovalRequest
          : false;

    if (!shouldNotify) return;

    const eventName =
      event.enforcementAction === "BLOCK"
        ? ("governance.enforcement.blocked" as const)
        : ("governance.enforcement.approval_required" as const);

    const payload: Record<string, unknown> = {
      organizationId: event.organizationId,
      projectId: event.projectId,
      providerName: event.providerName,
      modelName: event.modelName ?? null,
      action: event.enforcementAction,
      reason: event.reason,
      timestamp: new Date().toISOString(),
    };

    // ── Webhook dispatch ──
    void dispatchGovernanceWebhooks(event.projectId, eventName, payload);

    // ── Email dispatch ──
    void dispatchGovernanceEmail(event, policy.name ?? "Default Policy");

  } catch (error) {
    console.error("[SoterAI] Failed to dispatch governance enforcement notification:", error);
  }
}

async function dispatchGovernanceWebhooks(
  projectId: string,
  eventName: "governance.enforcement.blocked" | "governance.enforcement.approval_required",
  payload: Record<string, unknown>,
) {
  try {
    const endpoints = await db.webhookEndpoint.findMany({
      where: { projectId, isActive: true, events: { has: eventName } },
    });

    for (const endpoint of endpoints) {
      await enqueueWebhook({
        endpointId: endpoint.id,
        event: eventName,
        payload,
        idempotencyKey: `gov_${eventName}_${Date.now()}_${endpoint.id}`,
      });
    }
  } catch (error) {
    console.error("[SoterAI] Governance webhook dispatch failed:", error);
  }
}

async function dispatchGovernanceEmail(
  event: GovernanceEnforcementEvent,
  policyName: string,
) {
  try {
    // Find admin users in the organization to notify
    const admins = await db.organizationMember.findMany({
      where: {
        organizationId: event.organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    const adminEmails = admins
      .map((m) => m.user.email)
      .filter((email): email is string => !!email);

    if (adminEmails.length === 0) return;

    await sendTemplateEmail({
      to: adminEmails,
      template: "governance-enforcement-alert",
      data: {
        projectName: policyName,
        providerName: event.providerName,
        modelName: event.modelName ?? "",
        enforcementAction:
          event.enforcementAction === "BLOCK" ? "blocked" : "requires approval for",
        reason: event.reason,
        dashboardUrl: `${process.env.APP_URL ?? "https://soterai.publicvm.com"}/dashboard/usage-governance/monitoring`,
      },
    });
  } catch (error) {
    console.error("[SoterAI] Governance email dispatch failed:", error);
  }
}
