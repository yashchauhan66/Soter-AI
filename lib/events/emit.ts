import { db } from "../db";
import { sanitizeMetadata } from "../guard/logSafety";
import { withSecuritySpan } from "../observability/otel";
import type { SecurityEventInput } from "./securityEvent";
import { mirrorAuditEvent } from "./store";

export async function emitSecurityEvent(input: SecurityEventInput) {
  return withSecuritySpan("security.event.emit", { "security.event_type": input.eventType, "security.severity": input.severity }, async () => {
    const metadata = sanitizeMetadata(input.metadata ?? {});
    const event = await db.securityEvent.create({ data: { organizationId: input.organizationId, projectId: input.projectId, eventType: input.eventType, severity: input.severity, riskTypes: input.riskTypes ?? [], action: input.action, source: input.source, metadata } });
    await mirrorAuditEvent({
      id: event.id,
      orgId: input.organizationId,
      projectId: input.projectId,
      action: input.eventType,
      decision: input.action,
      severity: input.severity,
      categories: input.riskTypes ?? [],
      targetType: "SecurityEvent",
      targetId: event.id,
      metadata: { ...metadata, source: input.source },
      createdAt: event.createdAt,
    });
    const integrations = await db.siemIntegration.findMany({ where: { organizationId: input.organizationId, enabled: true }, select: { id: true } });
    if (integrations.length) await db.siemDelivery.createMany({ data: integrations.map((integration) => ({ integrationId: integration.id, eventId: event.id, status: "PENDING", nextAttemptAt: new Date() })), skipDuplicates: true });
    return event;
  });
}
