import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { parsePublicHttpsUrl } from "@/lib/network/outboundUrl";
import { sanitizePrivacyPayload } from "@/packages/shared/src/privacy";

export const SIEM_WEBHOOK_EVENT_TYPES = [
  "EXTENSION_HEARTBEAT",
  "PROMPT_BLOCKED",
  "PROMPT_REDACTED",
  "PROMPT_REWRITTEN",
  "APPROVAL_REQUESTED",
  "APPROVAL_APPROVED",
  "APPROVAL_REJECTED",
  "SHADOW_AI_DISCOVERED",
  "EMERGENCY_LOCKDOWN_ENABLED",
  "EMERGENCY_LOCKDOWN_DISABLED",
  "POLICY_SIGNATURE_FAILED",
] as const;

export type SiemWebhookEventType = (typeof SIEM_WEBHOOK_EVENT_TYPES)[number];

export interface SiemWebhookConfig {
  eventTypes: SiemWebhookEventType[];
  secretHash?: string;
  secretPreview?: string;
  createdAt?: string;
}

export interface SiemWebhookEvent {
  id: string;
  organizationId: string;
  projectId: string | null;
  eventType: string;
  severity: string;
  riskTypes: string[];
  action: string;
  source: string;
  createdAt: Date;
  metadata: unknown;
}

export function normalizeSiemEventType(eventType: string): string {
  if (eventType === "EXTENSION_SHADOW_AI_DISCOVERED") return "SHADOW_AI_DISCOVERED";
  if (eventType === "EXTENSION_APPROVAL_REQUEST") return "APPROVAL_REQUESTED";
  if (eventType === "EXTENSION_APPROVAL_GRANTED") return "APPROVAL_APPROVED";
  if (eventType === "EXTENSION_APPROVAL_REJECTED") return "APPROVAL_REJECTED";
  return eventType;
}

export function parseWebhookEndpoint(value: string) {
  return parsePublicHttpsUrl(value).toString();
}

export function hashWebhookSecret(secret: string) {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function previewWebhookSecret(secret: string) {
  return secret.length <= 8 ? "set" : `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

export function signWebhookPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return { timestamp, signature: `sha256=${signature}` };
}

export function redactedWebhookPayload(event: SiemWebhookEvent) {
  return {
    id: event.id,
    organizationId: event.organizationId,
    projectId: event.projectId,
    eventType: normalizeSiemEventType(event.eventType),
    severity: event.severity,
    riskTypes: event.riskTypes,
    action: event.action,
    source: event.source,
    timestamp: event.createdAt.toISOString(),
    metadata: sanitizePrivacyPayload(event.metadata && typeof event.metadata === "object" ? event.metadata as Record<string, unknown> : {}),
  };
}

export function encodeWebhookConfig(config: SiemWebhookConfig): string {
  const jsonConfig: Prisma.InputJsonObject = {
    eventTypes: config.eventTypes,
    ...(config.secretHash ? { secretHash: config.secretHash } : {}),
    ...(config.secretPreview ? { secretPreview: config.secretPreview } : {}),
    ...(config.createdAt ? { createdAt: config.createdAt } : {}),
  };
  return JSON.stringify(jsonConfig);
}

export function decodeWebhookConfig(value?: string | null): SiemWebhookConfig {
  if (!value) return { eventTypes: [...SIEM_WEBHOOK_EVENT_TYPES] };
  try {
    const parsed = JSON.parse(value) as Partial<SiemWebhookConfig>;
    return {
      eventTypes: (parsed.eventTypes ?? []).filter((event): event is SiemWebhookEventType =>
        SIEM_WEBHOOK_EVENT_TYPES.includes(event as SiemWebhookEventType),
      ),
      secretHash: parsed.secretHash,
      secretPreview: parsed.secretPreview,
      createdAt: parsed.createdAt,
    };
  } catch {
    return { eventTypes: [...SIEM_WEBHOOK_EVENT_TYPES] };
  }
}

export function webhookMatchesEvent(config: SiemWebhookConfig, eventType: string) {
  const normalized = normalizeSiemEventType(eventType);
  return config.eventTypes.includes(normalized as SiemWebhookEventType);
}
