import { createHash, randomBytes, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sanitizeMetadata } from "@/lib/guard/logSafety";

export const TRUST_EVENT_FORMAT = "soter.trust-event.v1" as const;

export type TrustEventSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TrustEventDecision = "ALLOW" | "BLOCK" | "ASK_APPROVAL" | "OBSERVE" | "ERROR";

export interface TrustEventInput {
  organizationId: string;
  projectId?: string | null;
  eventType: string;
  source: string;
  action: string;
  severity?: TrustEventSeverity;
  decision?: TrustEventDecision;
  riskTypes?: string[];
  traceId?: string;
  spanId?: string;
  parentSpanId?: string | null;
  causalRefs?: string[];
  correlationId?: string | null;
  sessionId?: string | null;
  agentIdentityId?: string | null;
  passportId?: string | null;
  policyDecisionId?: string | null;
  controlIds?: string[];
  resource?: { type: string; id?: string | null; classification?: string | null };
  metadata?: Record<string, unknown>;
  occurredAt?: Date | string;
}

export interface TrustEventEnvelope {
  format: typeof TRUST_EVENT_FORMAT;
  schemaVersion: 1;
  eventId: string;
  organizationId: string;
  projectId: string | null;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  causalRefs: string[];
  correlationId: string | null;
  sessionId: string | null;
  agentIdentityId: string | null;
  passportId: string | null;
  policyDecisionId: string | null;
  eventType: string;
  source: string;
  action: string;
  severity: TrustEventSeverity;
  decision: TrustEventDecision;
  riskTypes: string[];
  controlIds: string[];
  resource: { type: string; id: string | null; classification: string | null } | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  integrityHash: string;
}

export interface TrustTraceContext {
  traceId?: string;
  parentSpanId?: string;
  correlationId?: string | null;
  sessionId?: string | null;
}

export function createTraceId() {
  return randomBytes(16).toString("hex");
}

export function createSpanId() {
  return randomBytes(8).toString("hex");
}

export function buildTrustEvent(input: TrustEventInput): TrustEventEnvelope {
  const occurredAt = normalizeDate(input.occurredAt);
  const unsigned = {
    format: TRUST_EVENT_FORMAT,
    schemaVersion: 1 as const,
    eventId: `trust_evt_${randomUUID()}`,
    organizationId: cleanId(input.organizationId, "organizationId"),
    projectId: input.projectId ? cleanId(input.projectId, "projectId") : null,
    traceId: normalizeHexId(input.traceId, 32) ?? createTraceId(),
    spanId: normalizeHexId(input.spanId, 16) ?? createSpanId(),
    parentSpanId: input.parentSpanId ? normalizeHexId(input.parentSpanId, 16) ?? null : null,
    causalRefs: unique(input.causalRefs).slice(0, 50),
    correlationId: optionalText(input.correlationId, 200),
    sessionId: optionalText(input.sessionId, 200),
    agentIdentityId: optionalText(input.agentIdentityId, 200),
    passportId: optionalText(input.passportId, 200),
    policyDecisionId: optionalText(input.policyDecisionId, 200),
    eventType: requiredText(input.eventType, "eventType", 160),
    source: requiredText(input.source, "source", 160),
    action: requiredText(input.action, "action", 160),
    severity: input.severity ?? "INFO",
    decision: input.decision ?? "OBSERVE",
    riskTypes: unique(input.riskTypes).slice(0, 50),
    controlIds: unique(input.controlIds).slice(0, 50),
    resource: input.resource ? {
      type: requiredText(input.resource.type, "resource.type", 120),
      id: optionalText(input.resource.id, 300),
      classification: optionalText(input.resource.classification, 80),
    } : null,
    metadata: sanitizeMetadata(input.metadata),
    occurredAt,
  };
  return { ...unsigned, integrityHash: hashTrustEvent(unsigned) };
}

export function hashTrustEvent(event: Omit<TrustEventEnvelope, "integrityHash"> | Record<string, unknown>) {
  return createHash("sha256").update(stableStringify(event)).digest("hex");
}

export function verifyTrustEventIntegrity(event: TrustEventEnvelope) {
  const { integrityHash, ...unsigned } = event;
  return /^[a-f0-9]{64}$/.test(integrityHash) && hashTrustEvent(unsigned) === integrityHash;
}

export function isTrustEvent(value: unknown): value is TrustEventEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<TrustEventEnvelope>;
  return event.format === TRUST_EVENT_FORMAT
    && event.schemaVersion === 1
    && typeof event.traceId === "string"
    && typeof event.spanId === "string"
    && typeof event.integrityHash === "string";
}

export async function recordTrustEvent(input: TrustEventInput) {
  const envelope = buildTrustEvent(input);
  const stored = await db.securityEvent.create({
    data: {
      id: envelope.eventId,
      organizationId: envelope.organizationId,
      projectId: envelope.projectId,
      eventType: envelope.eventType,
      severity: envelope.severity,
      riskTypes: envelope.riskTypes,
      action: envelope.action,
      source: envelope.source,
      metadata: envelope as unknown as Prisma.InputJsonValue,
      createdAt: new Date(envelope.occurredAt),
    },
    select: { id: true, createdAt: true },
  });
  const integrations = await db.siemIntegration.findMany({
    where: { organizationId: envelope.organizationId, enabled: true },
    select: { id: true },
  });
  if (integrations.length) {
    await db.siemDelivery.createMany({
      data: integrations.map((integration) => ({ integrationId: integration.id, eventId: stored.id, status: "PENDING", nextAttemptAt: new Date() })),
      skipDuplicates: true,
    });
  }
  return { ...envelope, eventId: stored.id, occurredAt: stored.createdAt.toISOString() };
}

export async function recordTrustEventSafe(input: TrustEventInput) {
  try {
    return { event: await recordTrustEvent(input), persisted: true as const };
  } catch (error) {
    console.error("[SoterAI] Trust event persistence failed", error instanceof Error ? error.message : "Unknown error");
    return { event: buildTrustEvent(input), persisted: false as const };
  }
}

export function trustTraceContextFromHeaders(request: Request): TrustTraceContext {
  const traceId = request.headers.get("x-soter-trace-id")?.trim().toLowerCase();
  const parentSpanId = request.headers.get("x-soter-parent-span-id")?.trim().toLowerCase();
  return {
    traceId: traceId && /^[a-f0-9]{32}$/.test(traceId) ? traceId : undefined,
    parentSpanId: parentSpanId && /^[a-f0-9]{16}$/.test(parentSpanId) ? parentSpanId : undefined,
    correlationId: optionalText(request.headers.get("x-soter-correlation-id"), 200),
    sessionId: optionalText(request.headers.get("x-soter-session-id"), 200),
  };
}

export function trustTraceContextFromMetadata(metadata: unknown): TrustTraceContext {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const value = metadata as Record<string, unknown>;
  const traceId = typeof value.traceId === "string" ? value.traceId.trim().toLowerCase() : "";
  const parentSpanId = typeof value.parentSpanId === "string" ? value.parentSpanId.trim().toLowerCase() : "";
  return {
    traceId: /^[a-f0-9]{32}$/.test(traceId) ? traceId : undefined,
    parentSpanId: /^[a-f0-9]{16}$/.test(parentSpanId) ? parentSpanId : undefined,
    correlationId: typeof value.correlationId === "string" ? optionalText(value.correlationId, 200) : null,
    sessionId: typeof value.sessionId === "string" ? optionalText(value.sessionId, 200) : null,
  };
}

export function buildCausalGraph(events: TrustEventEnvelope[]) {
  const nodes = events.map((event) => ({
    id: event.eventId,
    spanId: event.spanId,
    eventType: event.eventType,
    action: event.action,
    severity: event.severity,
    decision: event.decision,
    source: event.source,
    occurredAt: event.occurredAt,
    integrityValid: verifyTrustEventIntegrity(event),
  }));
  const spans = new Map(events.map((event) => [event.spanId, event]));
  const eventIds = new Set(events.map((event) => event.eventId));
  const edges: Array<{ from: string; to: string; type: "PARENT" | "CAUSE" }> = [];
  const danglingRefs: string[] = [];

  for (const event of events) {
    if (event.parentSpanId) {
      const parent = spans.get(event.parentSpanId);
      if (parent) edges.push({ from: parent.eventId, to: event.eventId, type: "PARENT" });
      else danglingRefs.push(event.parentSpanId);
    }
    for (const ref of event.causalRefs) {
      if (eventIds.has(ref)) edges.push({ from: ref, to: event.eventId, type: "CAUSE" });
      else danglingRefs.push(ref);
    }
  }

  const children = new Set(edges.map((edge) => edge.to));
  return {
    traceId: events[0]?.traceId ?? null,
    nodes,
    edges,
    roots: nodes.filter((node) => !children.has(node.id)).map((node) => node.id),
    danglingRefs: [...new Set(danglingRefs)],
    integrityValid: nodes.every((node) => node.integrityValid),
  };
}

function normalizeDate(value?: Date | string) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) throw new Error("occurredAt must be a valid date.");
  return date.toISOString();
}

function normalizeHexId(value: string | undefined, length: number) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!new RegExp(`^[a-f0-9]{${length}}$`).test(normalized)) throw new Error(`Trace identifier must be ${length} hexadecimal characters.`);
  return normalized;
}

function cleanId(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) throw new Error(`${label} is required and must be at most 200 characters.`);
  return normalized;
}

function requiredText(value: string, label: string, max: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized.slice(0, max);
}

function optionalText(value: string | null | undefined, max: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function unique(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
