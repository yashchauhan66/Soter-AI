import { randomUUID } from "crypto";

import { envInt } from "../../dynamodb/config";
import { minimizeEventMetadata, redactEventPreview } from "./redaction";
import { redactSensitiveText } from "@/packages/shared/src/privacy";
import type { EventType, HeavyEvent, StoredEvent } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const TTL_ENV: Record<EventType, [string, number]> = {
  guard_event: ["DYNAMODB_EVENTS_TTL_GUARD_DAYS", 7],
  audit_event: ["DYNAMODB_EVENTS_TTL_AUDIT_DAYS", 90],
  webhook_delivery_event: ["DYNAMODB_EVENTS_TTL_WEBHOOK_DAYS", 14],
  incident_event: ["DYNAMODB_EVENTS_TTL_INCIDENT_DAYS", 180],
  payload_event: ["DYNAMODB_EVENTS_TTL_PAYLOAD_DAYS", 7],
  report_event: ["DYNAMODB_EVENTS_TTL_REPORT_DAYS", 30],
  worker_task_event: ["DYNAMODB_EVENTS_TTL_WORKER_DAYS", 14],
  rag_security_event: ["DYNAMODB_EVENTS_TTL_RAG_DAYS", 30],
  redteam_event: ["DYNAMODB_EVENTS_TTL_RETEAM_DAYS", 30],
  siem_delivery_event: ["DYNAMODB_EVENTS_TTL_WEBHOOK_DAYS", 14],
};

export function eventTtlDays(type: EventType): number {
  const [name, fallback] = TTL_ENV[type];
  return envInt(name, fallback, 1, 3650);
}

export function eventExpiresAt(type: EventType, createdAt: Date): number {
  return Math.floor((createdAt.getTime() + eventTtlDays(type) * DAY_MS) / 1000);
}

export function buildStoredEvent(input: HeavyEvent): StoredEvent {
  const id = input.id || randomUUID();
  const createdAt = normalizeDate(input.createdAt);
  const updatedAt = normalizeDate(input.updatedAt ?? createdAt);
  const base = {
    ...pickCommonFields(input),
    id,
    type: input.type,
    createdAt,
    updatedAt,
    expiresAt: eventExpiresAt(input.type, new Date(createdAt)),
    metadata: minimizeEventMetadata(input.metadata),
  };

  if (input.type === "guard_event") {
    requireField(input.projectId, "projectId", input.type);
    const decision = requireField(input.decision, "decision", input.type);
    return clean({
      ...base,
      pk: `PROJECT#${input.projectId}`,
      sk: `GUARD#${createdAt}#${id}`,
      gsi1pk: input.orgId ? `ORG#${input.orgId}` : undefined,
      gsi1sk: input.orgId ? `GUARD#${createdAt}#${id}` : undefined,
      gsi2pk: `PROJECT#${input.projectId}#TYPE#guard_event`,
      gsi2sk: `${createdAt}#${id}`,
      gsi3pk: `PROJECT#${input.projectId}#DECISION#${decision}`,
      gsi3sk: `${createdAt}#${id}`,
    });
  }

  if (input.type === "audit_event") {
    const orgId = requireField(input.orgId, "orgId", input.type);
    return clean({
      ...base,
      pk: `ORG#${orgId}`,
      sk: `AUDIT#${createdAt}#${id}`,
      gsi1pk: `ORG#${orgId}`,
      gsi1sk: `AUDIT#${createdAt}#${id}`,
    });
  }

  if (input.type === "webhook_delivery_event") {
    const webhookId = requireField(input.webhookId, "webhookId", input.type);
    return clean({
      ...base,
      pk: `WEBHOOK#${webhookId}`,
      sk: `DELIVERY#${createdAt}#${id}`,
      gsi1pk: input.projectId ? `PROJECT#${input.projectId}` : undefined,
      gsi1sk: input.projectId ? `WEBHOOK_DELIVERY#${createdAt}#${id}` : undefined,
      gsi4pk: `WEBHOOK#${webhookId}`,
      gsi4sk: `${createdAt}#${id}`,
    });
  }

  if (input.type === "incident_event") {
    const incidentId = requireField(input.incidentId, "incidentId", input.type);
    return clean({
      ...base,
      pk: `INCIDENT#${incidentId}`,
      sk: `EVENT#${createdAt}#${id}`,
      gsi1pk: input.projectId ? `PROJECT#${input.projectId}` : undefined,
      gsi1sk: input.projectId ? `INCIDENT_EVENT#${createdAt}#${id}` : undefined,
    });
  }

  if (input.type === "payload_event") {
    requireField(input.projectId, "projectId", input.type);
    return clean({
      ...base,
      pk: `PROJECT#${input.projectId}`,
      sk: `PAYLOAD#${createdAt}#${id}`,
      gsi1pk: input.orgId ? `ORG#${input.orgId}` : undefined,
      gsi1sk: input.orgId ? `PAYLOAD#${createdAt}#${id}` : undefined,
      gsi2pk: `PROJECT#${input.projectId}#TYPE#payload_event`,
      gsi2sk: `${createdAt}#${id}`,
    });
  }

  if (input.type === "report_event") {
    const reportId = requireField(input.reportId, "reportId", input.type);
    return clean({
      ...base,
      pk: `REPORT#${reportId}`,
      sk: `EVENT#${createdAt}#${id}`,
      gsi1pk: input.projectId ? `PROJECT#${input.projectId}` : undefined,
      gsi1sk: input.projectId ? `REPORT_EVENT#${createdAt}#${id}` : undefined,
    });
  }

  if (input.type === "worker_task_event") {
    const jobId = requireField(input.jobId, "jobId", input.type);
    return clean({
      ...base,
      pk: `JOB#${jobId}`,
      sk: `EVENT#${createdAt}#${id}`,
      gsi1pk: input.projectId ? `PROJECT#${input.projectId}` : undefined,
      gsi1sk: input.projectId ? `WORKER_EVENT#${createdAt}#${id}` : undefined,
    });
  }

  if (input.type === "rag_security_event") {
    requireField(input.projectId, "projectId", input.type);
    return clean({
      ...base,
      pk: `PROJECT#${input.projectId}`,
      sk: `RAG#${createdAt}#${id}`,
      gsi1pk: input.orgId ? `ORG#${input.orgId}` : undefined,
      gsi1sk: input.orgId ? `RAG#${createdAt}#${id}` : undefined,
      gsi2pk: `PROJECT#${input.projectId}#TYPE#rag_security_event`,
      gsi2sk: `${createdAt}#${id}`,
    });
  }

  if (input.type === "redteam_event") {
    requireField(input.projectId, "projectId", input.type);
    return clean({
      ...base,
      pk: `PROJECT#${input.projectId}`,
      sk: `REDTEAM#${createdAt}#${id}`,
      gsi1pk: input.orgId ? `ORG#${input.orgId}` : undefined,
      gsi1sk: input.orgId ? `REDTEAM#${createdAt}#${id}` : undefined,
    });
  }

  const orgId = requireField(input.orgId, "orgId", input.type);
  return clean({
    ...base,
    pk: `ORG#${orgId}`,
    sk: `SIEM_DELIVERY#${createdAt}#${id}`,
    gsi1pk: `ORG#${orgId}`,
    gsi1sk: `SIEM_DELIVERY#${createdAt}#${id}`,
  });
}

function normalizeDate(value?: Date | string): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("Event date is invalid.");
  return date.toISOString();
}

function requireField<T>(value: T | null | undefined, name: string, type: EventType): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${name} is required for ${type}.`);
  }
  return value;
}

function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function pickCommonFields(input: HeavyEvent) {
  return {
    orgId: input.orgId,
    projectId: input.projectId,
    userId: input.userId,
    actorUserId: input.actorUserId,
    apiKeyPrefix: input.apiKeyPrefix,
    requestId: input.requestId,
    sessionId: input.sessionId,
    webhookId: input.webhookId,
    incidentId: input.incidentId,
    reportId: input.reportId,
    jobId: input.jobId,
    detector: input.detector,
    guardType: input.guardType,
    decision: input.decision,
    riskScore: input.riskScore,
    severity: input.severity,
    status: input.status,
    categories: input.categories,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    httpStatus: input.httpStatus,
    method: input.method,
    endpoint: input.endpoint,
    latencyMs: input.latencyMs,
    provider: input.provider,
    model: input.model,
    inputLength: input.inputLength,
    outputLength: input.outputLength,
    redactedInputPreview: redactEventPreview(input.redactedInputPreview, "input"),
    redactedOutputPreview: redactEventPreview(input.redactedOutputPreview, "output"),
    errorCode: input.errorCode,
    errorMessage: input.errorMessage ? redactSensitiveText(input.errorMessage).slice(0, 2000) : input.errorMessage,
  };
}
