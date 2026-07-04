import { Prisma } from "@prisma/client";

import { db } from "../../db";
import { buildLogWhere, decodeCursor, encodeCursor, LOG_ORDER_BY } from "../../guard/logFilters";
import { guardLogListSelect } from "../../guard/logSelect";
import type { AuditLogDto, EventListFilters, EventPage, GuardEvent, GuardLogDto, HeavyEvent } from "./types";

export class PostgresEventStore {
  async writeGuardEvent(event: GuardEvent) {
    return db.guardLog.create({
      data: {
        id: event.id,
        projectId: event.projectId,
        apiKeyId: event.apiKeyId || undefined,
        direction: event.direction,
        originalText: event.originalText,
        redactedText: event.redactedInputPreview ?? event.redactedOutputPreview,
        safeText: event.safeText,
        action: event.decision as "ALLOW" | "ALLOW_WITH_REDACTION" | "REWRITE" | "BLOCK" | "HUMAN_REVIEW",
        riskScore: event.riskScore,
        riskTypes: event.categories,
        reason: event.reason,
        metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
        createdAt: event.createdAt ? new Date(event.createdAt) : undefined,
      },
    });
  }

  async writeAuditEvent(event: HeavyEvent) {
    if (!event.orgId) throw new Error("orgId is required for audit_event.");
    return db.aiUsageGovernanceAuditLog.create({
      data: {
        id: event.id,
        organizationId: event.orgId,
        userId: event.userId,
        providerName: event.provider,
        modelName: event.model,
        action: event.action ?? "AUDIT_EVENT",
        decision: event.decision ?? event.status ?? "RECORDED",
        reason: event.errorMessage ?? null,
        contextRedacted: event.redactedInputPreview ?? null,
        metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
        createdAt: event.createdAt ? new Date(event.createdAt) : undefined,
      },
    });
  }

  async listGuardEventsByProject(projectId: string, filters: EventListFilters = {}): Promise<EventPage<GuardLogDto>> {
    const where = buildLogWhere({ projectId }, {
      action: filters.decision as never,
      direction: filters.direction as never,
      riskType: filters.category,
      from: filters.from,
      to: filters.to,
      cursor: decodeCursor(filters.cursor),
      limit: clampLimit(filters.limit),
    });
    const limit = clampLimit(filters.limit);
    const rows = await db.guardLog.findMany({
      where,
      orderBy: LOG_ORDER_BY,
      take: limit + 1,
      select: { ...guardLogListSelect, projectId: true },
    });
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit && items.length ? encodeCursor(items[items.length - 1]) : null,
    };
  }

  async listGuardEventsByOrg(orgId: string, filters: EventListFilters = {}): Promise<EventPage<GuardLogDto>> {
    const where = buildLogWhere({ project: { organizationId: orgId } }, {
      action: filters.decision as never,
      direction: filters.direction as never,
      riskType: filters.category,
      from: filters.from,
      to: filters.to,
      cursor: decodeCursor(filters.cursor),
      limit: clampLimit(filters.limit),
    });
    const limit = clampLimit(filters.limit);
    const rows = await db.guardLog.findMany({
      where,
      orderBy: LOG_ORDER_BY,
      take: limit + 1,
      select: {
        ...guardLogListSelect,
        projectId: true,
        project: { select: { name: true } },
      },
    });
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit && items.length ? encodeCursor(items[items.length - 1]) : null,
    };
  }

  async listAuditEventsByOrg(orgId: string, filters: EventListFilters = {}): Promise<EventPage<AuditLogDto>> {
    const rows = await db.aiUsageGovernanceAuditLog.findMany({
      where: {
        organizationId: orgId,
        ...(filters.decision ? { decision: filters.decision } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.provider ? { providerName: filters.provider } : {}),
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.from || filters.to ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: clampLimit(filters.limit),
    });
    return { items: rows, nextCursor: null };
  }
}

function clampLimit(limit?: number) {
  return Math.min(100, Math.max(1, Math.trunc(limit ?? 50)));
}
