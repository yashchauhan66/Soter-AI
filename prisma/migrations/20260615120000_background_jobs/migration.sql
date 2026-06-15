DO $$ BEGIN
  CREATE TYPE "BackgroundJobType" AS ENUM (
    'MONTHLY_REPORT',
    'PDF_REPORT',
    'AUDIT_EXPORT',
    'RAG_DOCUMENT_SCAN',
    'REDTEAM_RUN',
    'ML_EVALUATION',
    'SCHEDULED_REPORT_DELIVERY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BackgroundJobStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BackgroundJob" (
  "id" TEXT NOT NULL,
  "type" "BackgroundJobType" NOT NULL,
  "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
  "dedupeKey" TEXT,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BackgroundJob_status_runAfter_idx" ON "BackgroundJob"("status", "runAfter");
CREATE INDEX IF NOT EXISTS "BackgroundJob_type_status_createdAt_idx" ON "BackgroundJob"("type", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "BackgroundJob_dedupeKey_status_idx" ON "BackgroundJob"("dedupeKey", "status");
