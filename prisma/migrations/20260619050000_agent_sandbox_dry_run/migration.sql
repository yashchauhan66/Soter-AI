-- Feature 5: Agent Sandbox Dry-Run

DO $$ BEGIN
  CREATE TYPE "AgentDryRunType" AS ENUM (
    'EMAIL',
    'FORM_SUBMIT',
    'TERMINAL',
    'FILE_WRITE',
    'FILE_DELETE',
    'API_CALL',
    'PAYMENT',
    'PACKAGE_INSTALL',
    'DATABASE_WRITE',
    'CUSTOM'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentDryRunDecision" AS ENUM ('SAFE_TO_EXECUTE', 'REQUIRE_APPROVAL', 'BLOCK', 'REVIEW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AgentDryRun" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "agentIdentityId" TEXT,
  "dryRunType" "AgentDryRunType" NOT NULL,
  "tool" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "simulatedPayloadRedacted" TEXT,
  "simulatedEffectsJson" JSONB NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "decision" "AgentDryRunDecision" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentDryRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentDryRun_projectId_sessionId_createdAt_idx"
  ON "AgentDryRun"("projectId", "sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentDryRun_projectId_decision_createdAt_idx"
  ON "AgentDryRun"("projectId", "decision", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentDryRun_projectId_dryRunType_createdAt_idx"
  ON "AgentDryRun"("projectId", "dryRunType", "createdAt");
