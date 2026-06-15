// SECURITY: Persists guard decisions and dispatches webhook + usage events.
// - Confidential text is redacted before storage via prepareSafeLogContent.
// - Plan enforcement is checked in /api/guard/{input,output} before reaching here.
// - Webhook deliveries are persisted to the durable queue, not delivered inline.

import { Prisma } from "@prisma/client";
import { db } from "../db";
import { startOfUtcDay } from "../utils";
import { dispatchGuardWebhooks, dispatchUsageWebhook } from "../webhooks/delivery";
import { planLimit, recordMonthlyUsage } from "../rateLimit";
import { USAGE_WARNING_THRESHOLD } from "../guard/constants";
import { prepareSafeLogContent } from "./logSafety";
import type { GuardDirection, GuardResult } from "./types";
import { emitSecurityEvent } from "../events/emit";
import { markGuardActivation } from "../phase8/onboarding";

export async function persistGuardResult(input: {
  projectId: string;
  apiKeyId?: string;
  direction: GuardDirection;
  result: GuardResult;
  requestMetadata?: Record<string, unknown>;
  projectContext?: {
    user?: { id: string; email: string | null };
    organizationId?: string | null;
    plan?: string;
    name?: string;
    organization?: { quotaOverride: number | null } | null;
  };
}) {
  const { result } = input;
  const safeLog = prepareSafeLogContent(result, input.requestMetadata);

  await db.$transaction([
    db.guardLog.create({
      data: {
        projectId: input.projectId,
        apiKeyId: input.apiKeyId,
        direction: input.direction,
        originalText: safeLog.originalText,
        redactedText: safeLog.redactedText,
        safeText: safeLog.safeText,
        action: result.action,
        riskScore: result.riskScore,
        riskTypes: result.riskTypes,
        reason: result.reason,
        metadata: safeLog.metadata as Prisma.InputJsonValue,
      },
    }),
    db.usageCounter.upsert({
      where: { projectId_date: { projectId: input.projectId, date: startOfUtcDay() } },
      create: {
        projectId: input.projectId,
        date: startOfUtcDay(),
        requestCount: 1,
        blockedCount: result.action === "BLOCK" ? 1 : 0,
        redactedCount: result.action === "ALLOW_WITH_REDACTION" ? 1 : 0,
      },
      update: {
        requestCount: { increment: 1 },
        blockedCount: { increment: result.action === "BLOCK" ? 1 : 0 },
        redactedCount: { increment: result.action === "ALLOW_WITH_REDACTION" ? 1 : 0 },
      },
    }),
  ]);

  // Mark onboarding done for the owner.
  const project = input.projectContext ?? await db.project.findUnique({
    where: { id: input.projectId },
    select: { user: { select: { id: true, email: true } }, organizationId: true, plan: true, name: true, organization: { select: { quotaOverride: true } } },
  });
  const owner = project?.user;
  if (owner?.id) {
    await db.onboardingProgress.upsert({
      where: { userId: owner.id },
      create: { userId: owner.id, firstGuardRequest: true },
      update: { firstGuardRequest: true },
    });
    if (result.action === "BLOCK" && result.riskScore >= 80 && owner.email) {
      const { sendTemplateEmail } = await import("../email/send");
      void sendTemplateEmail({ to: owner.email, template: "high-risk-alert", data: { projectName: project?.name ?? input.projectId } }).catch((error) => console.error("High-risk alert email failed", error));
    }
  }

  if (project?.organizationId && result.action !== "ALLOW") {
    const eventType = result.action === "BLOCK" ? "guard.blocked" : result.action === "ALLOW_WITH_REDACTION" ? "guard.redacted" : "guard.human_review";
    const severity = result.riskScore >= 86 ? "CRITICAL" : result.riskScore >= 61 ? "HIGH" : result.riskScore >= 31 ? "MEDIUM" : "LOW";
    void emitSecurityEvent({ organizationId: project.organizationId, projectId: input.projectId, eventType, severity, riskTypes: result.riskTypes, action: result.action, source: `guard.${input.direction.toLowerCase()}`, metadata: { riskScore: result.riskScore, direction: input.direction } }).catch((error) => console.error("Security event emission failed", error));
  }

  if (project?.organizationId) {
    void markGuardActivation({
      organizationId: project.organizationId,
      projectId: input.projectId,
      userId: owner?.id,
      action: result.action,
    }).catch((error) => console.error("Phase 8 activation tracking failed", error));
  }

  // Webhook fan-out: queued to the durable WebhookDelivery table.
  void dispatchGuardWebhooks({
    projectId: input.projectId,
    apiKeyId: input.apiKeyId,
    direction: input.direction,
    result,
    requestMetadata: input.requestMetadata,
  }).catch((error) => console.error("Webhook dispatch failed", error));

  // Usage telemetry: record in Redis for plan enforcement, surface warning/exceeded events.
  if (project?.organizationId && project.plan) {
    void maybeFireUsageWebhook(input.projectId, project.organizationId, project.plan, project.organization?.quotaOverride, owner?.email ?? undefined, project.name).catch((error) =>
      console.error("Usage webhook failed", error),
    );
  } else {
    void maybeFireUsageWebhookLegacy(input.projectId).catch((error) =>
      console.error("Usage webhook legacy failed", error),
    );
  }
}

async function maybeFireUsageWebhook(projectId: string, organizationId: string, plan: string, quotaOverride?: number | null, email?: string, projectName?: string) {
  const usage = await recordMonthlyUsage(organizationId, projectId, plan, 1, quotaOverride);
  if (usage.exceeded) {
    await dispatchUsageWebhook({
      projectId,
      event: "usage.limit.exceeded",
      payload: { used: usage.used, limit: usage.limit, ratio: usage.ratio, organizationId },
    });
    if (usage.used === usage.limit + 1 && email) {
      const { sendTemplateEmail } = await import("../email/send");
      await sendTemplateEmail({ to: email, template: "usage-exceeded", data: { projectName: projectName ?? projectId } });
    }
  } else if (usage.warning) {
    await dispatchUsageWebhook({
      projectId,
      event: "usage.limit.warning",
      payload: { used: usage.used, limit: usage.limit, ratio: usage.ratio, organizationId },
    });
    if (usage.used === Math.ceil(usage.limit * USAGE_WARNING_THRESHOLD) && email) {
      const { sendTemplateEmail } = await import("../email/send");
      await sendTemplateEmail({ to: email, template: "usage-warning", data: { projectName: projectName ?? projectId, percent: Math.round(usage.ratio * 100) } });
    }
  }
}

async function maybeFireUsageWebhookLegacy(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { plan: true } });
  if (!project) return;
  const limit = planLimit(project.plan);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const aggregate = await db.usageCounter.aggregate({
    where: { projectId, date: { gte: monthStart } },
    _sum: { requestCount: true },
  });
  const used = aggregate._sum.requestCount ?? 0;
  const ratio = limit > 0 ? used / limit : 0;
  if (used >= limit) {
    await dispatchUsageWebhook({ projectId, event: "usage.limit.exceeded", payload: { used, limit, ratio } });
  } else if (ratio >= USAGE_WARNING_THRESHOLD) {
    await dispatchUsageWebhook({ projectId, event: "usage.limit.warning", payload: { used, limit, ratio } });
  }
}
