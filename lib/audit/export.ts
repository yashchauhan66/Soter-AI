// SECURITY: Audit export streaming.
// - Only redacted aggregate fields are written; original_text is never included.
// - HMAC signature attached per export so downstream verifiers can confirm
//   provenance.
// - Output formats: JSONL (one event per line), CSV (flattened), PDF summary
//   delegates to lib/pdf/monthlyReport for now.

import { createHmac } from "crypto";
import type { GuardLog, WebhookDelivery } from "@prisma/client";
import { db } from "../db";

export type AuditExportRow = Record<string, string | number | boolean | string[] | null>;

export function exportSecret(): string {
  const secret = process.env.AUDIT_EXPORT_SECRET ?? process.env.API_KEY_PEPPER;
  if (!secret || secret.length < 16) {
    throw new Error("AUDIT_EXPORT_SECRET must be configured (min 16 chars).");
  }
  return secret;
}

export function signRow(row: AuditExportRow): string {
  return createHmac("sha256", exportSecret()).update(JSON.stringify(row)).digest("hex");
}

export function signManifest(rows: number, kind: string, organizationId: string, generatedAt: string) {
  return createHmac("sha256", exportSecret())
    .update(`${kind}:${organizationId}:${rows}:${generatedAt}`)
    .digest("hex");
}

export function guardLogToRow(log: GuardLog & { project?: { name: string; organizationId: string | null } }): AuditExportRow {
  return {
    id: log.id,
    timestamp: log.createdAt.toISOString(),
    organizationId: log.project?.organizationId ?? null,
    projectId: log.projectId,
    direction: log.direction,
    action: log.action,
    riskScore: log.riskScore,
    riskTypes: log.riskTypes,
    reason: log.reason,
    redactedTextPresent: Boolean(log.redactedText),
    safeTextPresent: Boolean(log.safeText),
  };
}

export function webhookDeliveryToRow(delivery: WebhookDelivery): AuditExportRow {
  return {
    id: delivery.id,
    timestamp: delivery.createdAt.toISOString(),
    endpointId: delivery.endpointId,
    event: delivery.event,
    status: delivery.status,
    attempts: delivery.attempts,
    responseCode: delivery.responseCode ?? null,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    payloadHash: delivery.payloadHash,
    idempotencyKey: delivery.idempotencyKey,
  };
}

export interface FetchOptions {
  organizationId: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  projectId?: string | null;
}

export async function fetchGuardLogs(options: FetchOptions) {
  return db.guardLog.findMany({
    where: {
      project: { organizationId: options.organizationId, ...(options.projectId ? { id: options.projectId } : {}) },
      ...(options.fromDate || options.toDate ? {
        createdAt: {
          ...(options.fromDate ? { gte: options.fromDate } : {}),
          ...(options.toDate ? { lt: options.toDate } : {}),
        },
      } : {}),
    },
    include: { project: { select: { name: true, organizationId: true } } },
    orderBy: { createdAt: "asc" },
    take: 25_000,
  });
}

export async function fetchWebhookDeliveries(options: FetchOptions) {
  return db.webhookDelivery.findMany({
    where: {
      endpoint: {
        project: {
          organizationId: options.organizationId,
          ...(options.projectId ? { id: options.projectId } : {}),
        },
      },
      ...(options.fromDate || options.toDate ? {
        createdAt: {
          ...(options.fromDate ? { gte: options.fromDate } : {}),
          ...(options.toDate ? { lt: options.toDate } : {}),
        },
      } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 25_000,
  });
}

export function rowsToJsonl(rows: AuditExportRow[]): string {
  return rows.map((row) => JSON.stringify({ ...row, signature: signRow(row) })).join("\n");
}

export function rowsToCsv(rows: AuditExportRow[]): string {
  if (!rows.length) return "";
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const str = Array.isArray(value) ? value.join(";") : String(value);
    return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
  };
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((col) => escape(row[col])).join(",")).join("\n");
  return `${header}\n${body}`;
}
