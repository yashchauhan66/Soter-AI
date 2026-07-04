export type EventType =
  | "guard_event"
  | "audit_event"
  | "webhook_delivery_event"
  | "incident_event"
  | "payload_event"
  | "report_event"
  | "worker_task_event"
  | "rag_security_event"
  | "redteam_event"
  | "siem_delivery_event";

export interface HeavyEvent {
  id?: string;
  type: EventType;
  orgId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  actorUserId?: string | null;
  apiKeyId?: string | null;
  apiKeyPrefix?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  webhookId?: string | null;
  incidentId?: string | null;
  reportId?: string | null;
  jobId?: string | null;
  detector?: string | null;
  guardType?: string | null;
  decision?: string | null;
  riskScore?: number | null;
  severity?: string | null;
  status?: string | null;
  categories?: string[];
  action?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  httpStatus?: number | null;
  method?: string | null;
  endpoint?: string | null;
  latencyMs?: number | null;
  provider?: string | null;
  model?: string | null;
  inputLength?: number | null;
  outputLength?: number | null;
  redactedInputPreview?: string | null;
  redactedOutputPreview?: string | null;
  metadata?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface GuardEvent extends HeavyEvent {
  type: "guard_event";
  projectId: string;
  guardType: string;
  decision: string;
  riskScore: number;
  categories: string[];
  metadata?: Record<string, unknown> | null;
  direction: "INPUT" | "OUTPUT" | "ANALYZE";
  reason: string;
  safeText?: string | null;
  originalText?: string | null;
}

export interface EventListFilters {
  limit?: number;
  cursor?: string | null;
  from?: Date;
  to?: Date;
  decision?: string;
  direction?: string;
  category?: string;
  status?: string;
  action?: string;
  provider?: string;
  userId?: string;
}

export interface EventPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface StoredEvent extends Omit<HeavyEvent, "createdAt" | "updatedAt"> {
  id: string;
  pk: string;
  sk: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: number;
  gsi1pk?: string;
  gsi1sk?: string;
  gsi2pk?: string;
  gsi2sk?: string;
  gsi3pk?: string;
  gsi3sk?: string;
  gsi4pk?: string;
  gsi4sk?: string;
}

export interface GuardLogDto {
  id: string;
  projectId: string;
  project?: { name: string };
  createdAt: Date | string;
  direction: string;
  action: string;
  riskScore: number;
  riskTypes: string[];
  reason: string;
  redactedText?: string | null;
  safeText?: string | null;
  metadata?: unknown;
}

export interface AuditLogDto {
  id: string;
  organizationId: string;
  userId: string | null;
  providerName: string | null;
  modelName: string | null;
  action: string;
  decision: string;
  reason: string | null;
  contextRedacted: string | null;
  metadata: unknown;
  createdAt: Date | string;
}
