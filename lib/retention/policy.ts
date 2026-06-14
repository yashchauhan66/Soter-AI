import type { DataRetentionWindow } from "@prisma/client";
import { db } from "@/lib/db";

export const RETENTION_WINDOWS: DataRetentionWindow[] = ["DAYS_7", "DAYS_30", "DAYS_90", "DAYS_180", "DAYS_365", "CUSTOM"];

export function retentionDays(window: DataRetentionWindow, customDays?: number | null): number {
  if (window === "DAYS_7") return 7;
  if (window === "DAYS_30") return 30;
  if (window === "DAYS_90") return 90;
  if (window === "DAYS_180") return 180;
  if (window === "DAYS_365") return 365;
  if (!customDays || customDays < 1) throw new Error("customDays is required for custom retention.");
  return customDays;
}

export function retentionCutoff(now: Date, window: DataRetentionWindow, customDays?: number | null): Date {
  return new Date(now.getTime() - retentionDays(window, customDays) * 24 * 60 * 60 * 1000);
}

export async function applyRetentionPolicy(organizationId: string, now = new Date()) {
  const policy = await db.retentionPolicy.findUnique({ where: { organizationId } });
  if (!policy) return { guardLogsDeleted: 0, webhookDeliveriesDeleted: 0, securityEventsDeleted: 0 };
  const cutoff = retentionCutoff(now, policy.window, policy.customDays);
  let guardLogsDeleted = 0;
  let webhookDeliveriesDeleted = 0;
  let securityEventsDeleted = 0;
  if (policy.applyToLogs) {
    const result = await db.guardLog.deleteMany({
      where: { createdAt: { lt: cutoff }, project: { organizationId } },
    });
    guardLogsDeleted = result.count;
  }
  if (policy.applyToWebhookDeliveries) {
    const result = await db.webhookDelivery.deleteMany({
      where: { createdAt: { lt: cutoff }, endpoint: { project: { organizationId } } },
    });
    webhookDeliveriesDeleted = result.count;
  }
  if (policy.applyToSecurityEvents) {
    const result = await db.securityEvent.deleteMany({ where: { organizationId, createdAt: { lt: cutoff } } });
    securityEventsDeleted = result.count;
  }
  await db.retentionPolicy.update({ where: { organizationId }, data: { lastRunAt: now } });
  await db.organizationAuditLog.create({
    data: {
      organizationId,
      action: "retention_policy_applied",
      category: "retention",
      metadata: { cutoff, guardLogsDeleted, webhookDeliveriesDeleted, securityEventsDeleted },
    },
  });
  return { guardLogsDeleted, webhookDeliveriesDeleted, securityEventsDeleted };
}

export function expectedDeletionConfirmation(scope: "PROJECT" | "ORGANIZATION" | "GUARD_LOGS", targetName: string) {
  return scope === "ORGANIZATION" ? `DELETE ORGANIZATION ${targetName}` : `DELETE ${scope} ${targetName}`;
}
