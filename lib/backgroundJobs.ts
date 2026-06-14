import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";

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
  return rows[0] ?? null;
}

export async function markJobFailed(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown background job error";
  const current = await findBackgroundJob(id);
  if (!current) return null;
  const exhausted = current.attempts >= current.maxAttempts;
  const rows = await db.$queryRaw<BackgroundJobRow[]>`
    UPDATE "BackgroundJob"
    SET "status" = ${exhausted ? "FAILED" : "PENDING"}::"BackgroundJobStatus",
        "error" = ${message},
        "runAfter" = ${exhausted ? current.runAfter : new Date(Date.now() + Math.min(60_000, 2_000 * Math.max(1, current.attempts)))},
        "completedAt" = ${exhausted ? new Date() : null},
        "updatedAt" = NOW()
    WHERE "id" = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
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
