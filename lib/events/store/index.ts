import { randomUUID } from "crypto";

import { dynamoEventsConfig } from "../../dynamodb/config";
import { DynamoDbEventStore } from "./dynamodb-event-store";
import { PostgresEventStore } from "./postgres-event-store";
import { redactEventPreview } from "./redaction";
import type {
  AuditLogDto,
  EventListFilters,
  EventPage,
  GuardEvent,
  GuardLogDto,
  HeavyEvent,
  StoredEvent,
} from "./types";

const postgres = new PostgresEventStore();

export function eventStoreFlags() {
  const config = dynamoEventsConfig();
  return {
    enabled: config.enabled,
    dualWrite: config.enabled && config.dualWrite,
    readFallbackPostgres: config.readFallbackPostgres,
  };
}

export async function writeGuardEvent(event: GuardEvent): Promise<{ id: string; dynamodb: boolean; postgres: boolean }> {
  const flags = eventStoreFlags();
  const prepared = prepareGuardEvent(event);
  let dynamodb = false;
  let postgresWritten = false;

  if (flags.enabled) {
    try {
      await new DynamoDbEventStore().write(prepared);
      dynamodb = true;
    } catch (error) {
      console.error("[SoterAI] DynamoDB guard event write failed", {
        projectId: prepared.projectId,
        eventId: prepared.id,
        message: error instanceof Error ? error.message : "Unknown DynamoDB error",
      });
    }
  }

  if (!flags.enabled || flags.dualWrite) {
    await postgres.writeGuardEvent(prepared);
    postgresWritten = true;
  }

  return { id: prepared.id!, dynamodb, postgres: postgresWritten };
}

export async function writeAuditEvent(event: Omit<HeavyEvent, "type">) {
  return writeHybridEvent(
    { ...event, type: "audit_event" },
    (prepared) => postgres.writeAuditEvent(prepared),
  );
}

export const mirrorAuditEvent = (event: Omit<HeavyEvent, "type">) =>
  writeMirrorEvent({ ...event, type: "audit_event" });

export const writeWebhookDeliveryEvent = (event: Omit<HeavyEvent, "type">) =>
  writeMirrorEvent({ ...event, type: "webhook_delivery_event" });
export const writeIncidentEvent = (event: Omit<HeavyEvent, "type">) =>
  writeMirrorEvent({ ...event, type: "incident_event" });
export const writePayloadEvent = (event: Omit<HeavyEvent, "type">) =>
  writeMirrorEvent({ ...event, type: "payload_event" });
export const writeReportEvent = (event: Omit<HeavyEvent, "type">) =>
  writeMirrorEvent({ ...event, type: "report_event" });
export const writeWorkerTaskEvent = (event: Omit<HeavyEvent, "type">) =>
  writeMirrorEvent({ ...event, type: "worker_task_event" });
export const writeRagSecurityEvent = (event: Omit<HeavyEvent, "type">) =>
  writeMirrorEvent({ ...event, type: "rag_security_event" });
export const writeRedTeamEvent = (event: Omit<HeavyEvent, "type">) =>
  writeMirrorEvent({ ...event, type: "redteam_event" });
export const writeSiemDeliveryEvent = (event: Omit<HeavyEvent, "type">) =>
  writeMirrorEvent({ ...event, type: "siem_delivery_event" });

export async function writeEventDirectToDynamo(event: HeavyEvent): Promise<StoredEvent> {
  return new DynamoDbEventStore().write(event);
}

export async function listGuardEventsByProject(projectId: string, filters: EventListFilters = {}): Promise<EventPage<GuardLogDto>> {
  const flags = eventStoreFlags();
  if (flags.enabled) {
    try {
      const page = await new DynamoDbEventStore().listGuardEventsByProject(projectId, filters);
      if (page.items.length || !flags.readFallbackPostgres) return mapGuardPage(page);
    } catch (error) {
      if (!flags.readFallbackPostgres) throw error;
      console.error("[SoterAI] DynamoDB guard event read failed; falling back to PostgreSQL", error);
    }
  }
  return postgres.listGuardEventsByProject(projectId, filters);
}

export async function listGuardEventsByOrg(orgId: string, filters: EventListFilters = {}): Promise<EventPage<GuardLogDto>> {
  const flags = eventStoreFlags();
  if (flags.enabled) {
    try {
      const page = await new DynamoDbEventStore().listGuardEventsByOrg(orgId, filters);
      if (page.items.length || !flags.readFallbackPostgres) return mapGuardPage(page);
    } catch (error) {
      if (!flags.readFallbackPostgres) throw error;
      console.error("[SoterAI] DynamoDB organization guard read failed; falling back to PostgreSQL", error);
    }
  }
  return postgres.listGuardEventsByOrg(orgId, filters);
}

export async function listAuditEventsByOrg(orgId: string, filters: EventListFilters = {}): Promise<EventPage<AuditLogDto>> {
  const flags = eventStoreFlags();
  if (flags.enabled) {
    try {
      const page = await new DynamoDbEventStore().listAuditEventsByOrg(orgId, filters);
      if (page.items.length || !flags.readFallbackPostgres) {
        return {
          items: page.items.map(mapAuditEvent),
          nextCursor: page.nextCursor,
        };
      }
    } catch (error) {
      if (!flags.readFallbackPostgres) throw error;
      console.error("[SoterAI] DynamoDB audit read failed; falling back to PostgreSQL", error);
    }
  }
  return postgres.listAuditEventsByOrg(orgId, filters);
}

export const listWebhookDeliveryEvents = (webhookId: string, filters?: EventListFilters) =>
  new DynamoDbEventStore().listWebhookDeliveryEvents(webhookId, filters);
export const listIncidentEvents = (incidentId: string, filters?: EventListFilters) =>
  new DynamoDbEventStore().listIncidentEvents(incidentId, filters);
export const listPayloadEventsByProject = (projectId: string, filters?: EventListFilters) =>
  new DynamoDbEventStore().listProjectTypeEvents(projectId, "payload_event", filters);
export const listReportEvents = (reportId: string, filters?: EventListFilters) =>
  new DynamoDbEventStore().listReportEvents(reportId, filters);
export const listWorkerTaskEvents = (jobId: string, filters?: EventListFilters) =>
  new DynamoDbEventStore().listWorkerTaskEvents(jobId, filters);
export const listRagSecurityEventsByProject = (projectId: string, filters?: EventListFilters) =>
  new DynamoDbEventStore().listProjectTypeEvents(projectId, "rag_security_event", filters);
export const listRedTeamEventsByProject = (projectId: string, filters?: EventListFilters) =>
  new DynamoDbEventStore().listProjectPrefixEvents(projectId, "REDTEAM#", filters);

function prepareGuardEvent(event: GuardEvent): GuardEvent {
  const inputText = event.redactedInputPreview ?? (event.direction === "INPUT" || event.direction === "ANALYZE" ? event.originalText : null);
  const outputText = event.redactedOutputPreview ?? (event.direction === "OUTPUT" ? event.originalText : null);
  return {
    ...event,
    id: event.id || randomUUID(),
    redactedInputPreview: redactEventPreview(inputText, "input"),
    redactedOutputPreview: redactEventPreview(outputText, "output"),
  };
}

async function writeHybridEvent(event: HeavyEvent, postgresWrite: (prepared: HeavyEvent) => Promise<unknown>) {
  const flags = eventStoreFlags();
  const prepared = { ...event, id: event.id || randomUUID() };
  if (flags.enabled) {
    try {
      await new DynamoDbEventStore().write(prepared);
    } catch (error) {
      console.error(`[SoterAI] DynamoDB ${event.type} write failed`, error);
    }
  }
  if (!flags.enabled || flags.dualWrite) await postgresWrite(prepared);
  return prepared;
}

async function writeMirrorEvent(event: HeavyEvent) {
  if (!eventStoreFlags().enabled) return null;
  const prepared = { ...event, id: event.id || randomUUID() };
  try {
    return await new DynamoDbEventStore().write(prepared);
  } catch (error) {
    console.error(`[SoterAI] DynamoDB ${event.type} mirror failed`, error);
    return null;
  }
}

function mapGuardPage(page: EventPage<StoredEvent>): EventPage<GuardLogDto> {
  return {
    items: page.items.map((item) => ({
      id: item.id,
      projectId: item.projectId!,
      createdAt: item.createdAt,
      direction: item.guardType ?? "ANALYZE",
      action: item.decision ?? "ALLOW",
      riskScore: item.riskScore ?? 0,
      riskTypes: item.categories ?? [],
      reason: typeof item.metadata?.reason === "string" ? item.metadata.reason : "",
      redactedText: item.redactedInputPreview ?? item.redactedOutputPreview ?? null,
      safeText: null,
      metadata: item.metadata ?? {},
    })),
    nextCursor: page.nextCursor,
  };
}

function mapAuditEvent(item: StoredEvent): AuditLogDto {
  return {
    id: item.id,
    organizationId: item.orgId!,
    userId: item.userId ?? null,
    providerName: item.provider ?? null,
    modelName: item.model ?? null,
    action: item.action ?? "AUDIT_EVENT",
    decision: item.decision ?? item.status ?? "RECORDED",
    reason: item.errorMessage ?? (typeof item.metadata?.reason === "string" ? item.metadata.reason : null),
    contextRedacted: item.redactedInputPreview ?? null,
    metadata: item.metadata ?? {},
    createdAt: item.createdAt,
  };
}

export type {
  AuditLogDto,
  EventListFilters,
  EventPage,
  GuardEvent,
  GuardLogDto,
  HeavyEvent,
  StoredEvent,
} from "./types";
