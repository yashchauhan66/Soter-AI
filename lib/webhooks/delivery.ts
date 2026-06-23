// SECURITY: Durable webhook queue + delivery worker.
// - All deliveries are persisted to WebhookDelivery before any HTTP attempt.
// - Idempotency key is unique per delivery; receivers should use it to dedupe.
// - Payloads never contain raw secrets or original user text. The redacted/safe
//   text + sanitised metadata only is sent.
// - Retries use exponential backoff: 30s, 2m, 10m, 1h, 6h (max 5 attempts).
// - Manual replay is supported via /api/webhooks/[id]/replay.

import { createHash } from "crypto";
import { db } from "../db";
import { sanitizeLogText, sanitizeMetadata } from "../guard/logSafety";
import { emitSecurityEvent } from "../events/emit";
import { assertPublicOutboundUrl } from "../network/outboundUrl";
import type { GuardResult } from "../guard/types";
import { signWebhookPayload, type WebhookEvent } from "./signing";
import { getEndpointSecret } from "./store";

const DELIVERY_TIMEOUT_MS = 5_000;
const BACKOFF_SCHEDULE_MS = [30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
const MAX_ATTEMPTS = BACKOFF_SCHEDULE_MS.length + 1; // initial + retries

export type EnqueueInput = {
  endpointId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
};

export async function enqueueWebhook(input: EnqueueInput) {
  const payloadHash = createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
  return db.webhookDelivery.create({
    data: {
      endpointId: input.endpointId,
      event: input.event,
      status: "PENDING",
      attempts: 0,
      payloadHash,
      payloadPreview: input.payload as object,
      idempotencyKey: input.idempotencyKey,
      nextAttemptAt: new Date(),
    },
  });
}

async function postOnce(url: string, headers: Record<string, string>, body: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const endpoint = await assertPublicOutboundUrl(url);
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    return { ok: response.ok, status: response.status, body: sanitizeLogText(text.slice(0, 1000)) };
  } finally {
    clearTimeout(timer);
  }
}

export async function attemptDelivery(deliveryId: string) {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: { include: { project: { select: { organizationId: true, name: true, user: { select: { email: true } } } } } } },
  });
  if (!delivery) return { skipped: true, reason: "missing" };
  if (delivery.status === "DELIVERED" || delivery.status === "SUCCESS") return { skipped: true, reason: "already_delivered" };
  if (delivery.status === "CANCELLED") return { skipped: true, reason: "cancelled" };
  if (!delivery.endpoint.isActive) {
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "CANCELLED", errorMessage: "Endpoint disabled before delivery." },
    });
    return { skipped: true, reason: "endpoint_disabled" };
  }
  const secret = await getEndpointSecret(delivery.endpoint.id);
  if (!secret) {
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", errorMessage: "Signing secret unavailable. Rotate to issue a new one." },
    });
    if (delivery.endpoint.project.organizationId) await emitSecurityEvent({ organizationId: delivery.endpoint.project.organizationId, projectId: delivery.endpoint.projectId, eventType: "webhook.failed", severity: "HIGH", riskTypes: ["WEBHOOK_SECRET_UNAVAILABLE"], action: "FAILED", source: "webhook.delivery", metadata: { endpointId: delivery.endpoint.id, deliveryId: delivery.id } });
    return { skipped: true, reason: "missing_secret" };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    id: delivery.idempotencyKey,
    event: delivery.event,
    createdAt: timestamp,
    data: delivery.payloadPreview,
  });
  const signature = signWebhookPayload(secret, timestamp, body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SoterAI-Webhooks/1.0",
    "x-cyberrakshak-event": delivery.event,
    "x-cyberrakshak-timestamp": String(timestamp),
    "x-cyberrakshak-signature": `t=${timestamp},v1=${signature}`,
    "x-cyberrakshak-idempotency-key": delivery.idempotencyKey,
    "x-cyberrakshak-attempt": String(delivery.attempts + 1),
  };

  let result: { ok: boolean; status: number; body: string } | null = null;
  let networkError: string | null = null;
  try {
    result = await postOnce(delivery.endpoint.url, headers, body);
  } catch (caught) {
    networkError = caught instanceof Error ? caught.message : "Network error";
  }

  const attemptNumber = delivery.attempts + 1;
  if (result?.ok) {
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "DELIVERED",
        responseCode: result.status,
        responseBody: result.body,
        attempts: attemptNumber,
        deliveredAt: new Date(),
        errorMessage: null,
        nextAttemptAt: null,
      },
    });
    return { success: true, status: result.status, attempts: attemptNumber };
  }

  if (attemptNumber >= MAX_ATTEMPTS) {
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "DEAD_LETTER",
        attempts: attemptNumber,
        responseCode: result?.status ?? null,
        responseBody: result?.body ?? null,
        errorMessage: networkError ?? `HTTP ${result?.status}`,
        nextAttemptAt: null,
        deadLetteredAt: new Date(),
      },
    });
    const project = delivery.endpoint.project;
    if (project.user.email) {
      const { sendTemplateEmail } = await import("../email/send");
      await sendTemplateEmail({ to: project.user.email, template: "webhook-failure", data: { projectName: project.name } }).catch((error) => console.error("Webhook failure email failed", error));
    }
    if (project.organizationId) await emitSecurityEvent({ organizationId: project.organizationId, projectId: delivery.endpoint.projectId, eventType: "webhook.failed", severity: "HIGH", riskTypes: ["WEBHOOK_DELIVERY_FAILED"], action: "DEAD_LETTER", source: "webhook.delivery", metadata: { endpointId: delivery.endpoint.id, deliveryId: delivery.id, attempts: attemptNumber, responseCode: result?.status ?? null } });
    return { success: false, terminal: true, attempts: attemptNumber, error: networkError ?? `HTTP ${result?.status}` };
  }

  const backoff = BACKOFF_SCHEDULE_MS[attemptNumber - 1] ?? BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
  await db.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "RETRYING",
      attempts: attemptNumber,
      responseCode: result?.status ?? null,
      responseBody: result?.body ?? null,
      errorMessage: networkError ?? `HTTP ${result?.status}`,
      nextAttemptAt: new Date(Date.now() + backoff),
    },
  });
  return { success: false, terminal: false, attempts: attemptNumber, retryInMs: backoff };
}

export async function processDuePending(limit = 25) {
  const due = await db.webhookDelivery.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const results: { id: string; ok: boolean }[] = [];
  for (const delivery of due) {
    try {
      const outcome = await attemptDelivery(delivery.id);
      results.push({ id: delivery.id, ok: !!outcome.success });
    } catch (caught) {
      results.push({ id: delivery.id, ok: false });
      console.error("Webhook attempt threw", caught);
    }
  }
  return results;
}

// --- Guard event helpers ---

export function eventsForGuardResult(result: GuardResult): WebhookEvent[] {
  const events: WebhookEvent[] = [];
  const types = new Set(result.riskTypes);
  if (types.has("PROMPT_INJECTION") && result.action === "BLOCK") events.push("guard.prompt_injection.blocked");
  if (types.has("JAILBREAK")) events.push("guard.jailbreak.detected");
  if (types.has("SECRET_DETECTED")) events.push("guard.secret.detected");
  if ((types.has("PII_DETECTED") || types.has("INDIA_PII_DETECTED")) && result.action === "ALLOW_WITH_REDACTION") events.push("guard.pii.redacted");
  if ((types.has("SYSTEM_PROMPT_LEAK_ATTEMPT") || types.has("SYSTEM_PROMPT_LEAKAGE")) && result.action === "BLOCK") events.push("guard.system_prompt_leak.blocked");
  if (types.has("UNSAFE_OUTPUT") && result.action === "BLOCK") events.push("guard.unsafe_output.blocked");
  return events;
}

export function buildGuardEventPayload(input: {
  projectId: string;
  apiKeyId?: string;
  direction: string;
  result: GuardResult;
  requestMetadata?: Record<string, unknown>;
}) {
  const { result } = input;
  return {
    projectId: input.projectId,
    apiKeyId: input.apiKeyId ?? null,
    direction: input.direction,
    action: result.action,
    riskScore: result.riskScore,
    riskTypes: result.riskTypes,
    reason: result.reason,
    redactedText: result.redactedText ?? null,
    findings: result.findings.map((finding) => ({
      type: finding.type,
      label: finding.label,
      severity: finding.severity,
      score: finding.score,
      message: finding.message,
    })),
    metadata: sanitizeMetadata(input.requestMetadata),
  };
}

export async function dispatchGuardWebhooks(input: {
  projectId: string;
  apiKeyId?: string;
  direction: string;
  result: GuardResult;
  requestMetadata?: Record<string, unknown>;
}) {
  const events = eventsForGuardResult(input.result);
  if (!events.length) return;
  const endpoints = await db.webhookEndpoint.findMany({
    where: { projectId: input.projectId, isActive: true },
  });
  if (!endpoints.length) return;
  const payload = buildGuardEventPayload(input);
  const enqueueWork: Promise<unknown>[] = [];
  for (const endpoint of endpoints) {
    for (const event of events) {
      if (!endpoint.events.includes(event)) continue;
      enqueueWork.push(enqueueWebhook({ endpointId: endpoint.id, event, payload }));
    }
  }
  await Promise.allSettled(enqueueWork);
}

export async function dispatchUsageWebhook(input: {
  projectId: string;
  event: "usage.limit.warning" | "usage.limit.exceeded";
  payload: Record<string, unknown>;
}) {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { projectId: input.projectId, isActive: true, events: { has: input.event } },
  });
  for (const endpoint of endpoints) {
    await enqueueWebhook({ endpointId: endpoint.id, event: input.event, payload: input.payload });
  }
}
