import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { writeWorkerTaskEvent } from "./events/store";

export type BackgroundJobType =
  | "MONTHLY_REPORT"
  | "PDF_REPORT"
  | "AUDIT_EXPORT"
  | "RAG_DOCUMENT_SCAN"
  | "REDTEAM_RUN"
  | "ML_EVALUATION"
  | "SCHEDULED_REPORT_DELIVERY";

export type BackgroundJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface BackgroundJobRow {
  id: string;
  type: BackgroundJobType;
  status: BackgroundJobStatus;
  dedupeKey: string | null;
  payload: Prisma.JsonValue;
  result: Prisma.JsonValue | null;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  runAfter: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueJobInput {
  type: BackgroundJobType;
  payload: Prisma.InputJsonValue;
  dedupeKey?: string;
  runAfter?: Date;
  maxAttempts?: number;
}

const MAX_RETRY_DELAY_MS = 60_000;
const MAX_ERROR_BYTES = 2_000;

export function nextBackgroundJobFailureState(input: {
  attempts: number;
  maxAttempts: number;
  now?: Date;
}) {
  const exhausted = input.attempts >= input.maxAttempts;
  const delayMs = exhausted ? 0 : Math.min(MAX_RETRY_DELAY_MS, 2_000 * 2 ** Math.max(0, input.attempts - 1));
  return {
    exhausted,
    status: exhausted ? "FAILED" as const : "PENDING" as const,
    event: exhausted ? "DEAD_LETTER" as const : "RETRY_SCHEDULED" as const,
    runAfter: exhausted ? input.now ?? new Date() : new Date((input.now ?? new Date()).getTime() + delayMs),
    delayMs,
  };
}

function boundedError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown background job error";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, MAX_ERROR_BYTES);
}

export async function enqueueBackgroundJob(input: EnqueueJobInput): Promise<BackgroundJobRow> {
  if (input.dedupeKey) {
    const existing = await db.$queryRaw<BackgroundJobRow[]>`
      SELECT * FROM "BackgroundJob"
      WHERE "type" = ${input.type}::"BackgroundJobType"
        AND "dedupeKey" = ${input.dedupeKey}
        AND "status" IN ('PENDING'::"BackgroundJobStatus", 'RUNNING'::"BackgroundJobStatus")
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (existing[0]) return existing[0];
  }

  const id = `job_${randomUUID()}`;
  const rows = await db.$queryRaw<BackgroundJobRow[]>`
    INSERT INTO "BackgroundJob" (
      "id", "type", "status", "dedupeKey", "payload", "attempts", "maxAttempts", "runAfter", "createdAt", "updatedAt"
    )
    VALUES (
      ${id},
      ${input.type}::"BackgroundJobType",
      'PENDING'::"BackgroundJobStatus",
      ${input.dedupeKey ?? null},
      ${input.payload}::jsonb,
      0,
      ${input.maxAttempts ?? 3},
      ${input.runAfter ?? new Date()},
      NOW(),
      NOW()
    )
    RETURNING *
  `;
  if (rows[0]) await recordJobEvent(rows[0], "ENQUEUED");
  return rows[0];
}

export async function markJobComplete(id: string, result?: Prisma.InputJsonValue) {
  const rows = await db.$queryRaw<BackgroundJobRow[]>`
    UPDATE "BackgroundJob"
    SET "status" = 'COMPLETED'::"BackgroundJobStatus",
        "result" = ${result ?? Prisma.JsonNull}::jsonb,
        "completedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING *
  `;
  if (rows[0]) await recordJobEvent(rows[0], "COMPLETED");
  return rows[0] ?? null;
}

export async function markJobFailed(id: string, error: unknown) {
  const message = boundedError(error);
  const current = await findBackgroundJob(id);
  if (!current) return null;
  const failure = nextBackgroundJobFailureState(current);
  const rows = await db.$queryRaw<BackgroundJobRow[]>`
    UPDATE "BackgroundJob"
    SET "status" = ${failure.status}::"BackgroundJobStatus",
        "error" = ${message},
        "runAfter" = ${failure.runAfter},
        "completedAt" = ${failure.exhausted ? new Date() : null},
        "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING *
  `;
  if (rows[0]) await recordJobEvent(rows[0], failure.event, message);
  return rows[0] ?? null;
}

/**
 * Recover jobs abandoned by a crashed worker. Exhausted jobs become the
 * terminal FAILED/dead-letter state; the rest are safely made claimable again.
 */
export async function recoverStaleBackgroundJobs(leaseMs = 5 * 60_000) {
  const safeLeaseMs = Math.max(30_000, Math.min(60 * 60_000, leaseMs));
  const staleBefore = new Date(Date.now() - safeLeaseMs);
  const stale = await db.$queryRaw<BackgroundJobRow[]>`
    SELECT * FROM "BackgroundJob"
    WHERE "status" = 'RUNNING'::"BackgroundJobStatus"
      AND "startedAt" < ${staleBefore}
    ORDER BY "startedAt" ASC
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  `;
  const recovered: BackgroundJobRow[] = [];
  for (const job of stale) {
    const failure = nextBackgroundJobFailureState(job);
    const rows = await db.$queryRaw<BackgroundJobRow[]>`
      UPDATE "BackgroundJob"
      SET "status" = ${failure.status}::"BackgroundJobStatus",
          "error" = 'Worker lease expired before completion.',
          "runAfter" = ${failure.runAfter},
          "completedAt" = ${failure.exhausted ? new Date() : null},
          "updatedAt" = NOW()
      WHERE "id" = ${job.id}
        AND "status" = 'RUNNING'::"BackgroundJobStatus"
      RETURNING *
    `;
    if (rows[0]) {
      recovered.push(rows[0]);
      await recordJobEvent(rows[0], failure.exhausted ? "DEAD_LETTER" : "LEASE_RECOVERED", "Worker lease expired before completion.");
    }
  }
  return recovered;
}

export async function claimNextBackgroundJob(types?: BackgroundJobType[]) {
  const typeFilter = types?.length
    ? Prisma.sql`AND "type" IN (${Prisma.join(types.map((type) => Prisma.sql`${type}::"BackgroundJobType"`))})`
    : Prisma.empty;
  const rows = await db.$queryRaw<BackgroundJobRow[]>`
    UPDATE "BackgroundJob"
    SET "status" = 'RUNNING'::"BackgroundJobStatus",
        "attempts" = "attempts" + 1,
        "startedAt" = NOW(),
        "error" = NULL,
        "updatedAt" = NOW()
    WHERE "id" = (
      SELECT "id" FROM "BackgroundJob"
      WHERE "status" = 'PENDING'::"BackgroundJobStatus"
        AND "runAfter" <= NOW()
        ${typeFilter}
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  if (rows[0]) await recordJobEvent(rows[0], "RUNNING");
  return rows[0] ?? null;
}

export async function findBackgroundJob(id: string) {
  const rows = await db.$queryRaw<BackgroundJobRow[]>`
    SELECT * FROM "BackgroundJob"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export function jobAcceptedResponse(job: { id: string; status: BackgroundJobStatus }, extra?: Record<string, unknown>) {
  return {
    accepted: true,
    jobId: job.id,
    status: job.status,
    ...extra,
  };
}

async function recordJobEvent(job: BackgroundJobRow, status: string, errorMessage?: string) {
  const payload = job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
    ? job.payload as Record<string, unknown>
    : {};
  await writeWorkerTaskEvent({
    orgId: stringValue(payload.organizationId),
    projectId: stringValue(payload.projectId),
    jobId: job.id,
    action: job.type,
    status,
    errorMessage,
    metadata: {
      dedupeKey: job.dedupeKey,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      runAfter: job.runAfter.toISOString(),
    },
  });
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
