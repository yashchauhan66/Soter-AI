import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const WEBHOOK_ENDPOINT_SAFE_SELECT = {
  id: true,
  projectId: true,
  url: true,
  description: true,
  secretPreview: true,
  secretRotatedAt: true,
  events: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WebhookEndpointSelect;

export type SafeWebhookEndpoint = Prisma.WebhookEndpointGetPayload<{
  select: typeof WEBHOOK_ENDPOINT_SAFE_SELECT;
}>;

export async function findWebhookEndpointForCurrentUser(id: string) {
  const user = await requireUser();
  let endpoint = await db.webhookEndpoint.findFirst({
    where: {
      id,
      project: {
        organization: {
          members: { some: { userId: user.id } },
        },
      },
    },
    select: WEBHOOK_ENDPOINT_SAFE_SELECT,
  });

  if (!endpoint && user.isAdmin) {
    endpoint = await db.webhookEndpoint.findUnique({
      where: { id },
      select: WEBHOOK_ENDPOINT_SAFE_SELECT,
    });
    return { user, endpoint, adminOverride: Boolean(endpoint) };
  }

  return { user, endpoint, adminOverride: false };
}

export async function findWebhookDeliveryForCurrentUser(id: string) {
  const user = await requireUser();
  let delivery = await db.webhookDelivery.findFirst({
    where: {
      id,
      endpoint: {
        project: {
          organization: {
            members: { some: { userId: user.id } },
          },
        },
      },
    },
    include: { endpoint: { select: { id: true, projectId: true } } },
  });

  if (!delivery && user.isAdmin) {
    delivery = await db.webhookDelivery.findUnique({
      where: { id },
      include: { endpoint: { select: { id: true, projectId: true } } },
    });
    return { user, delivery, adminOverride: Boolean(delivery) };
  }

  return { user, delivery, adminOverride: false };
}

export async function auditWebhookAdminOverride(input: {
  adminUserId: string;
  organizationId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  await db.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      organizationId: input.organizationId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
