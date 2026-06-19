-- Feature 3: Tool Chain Attack Detector

DO $$ BEGIN
  CREATE TYPE "ToolChainSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ToolChainDecision" AS ENUM ('ALLOW', 'BLOCK', 'ASK_APPROVAL', 'REVIEW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ToolChainFindingType" AS ENUM (
    'DATA_EXFILTRATION_CHAIN',
    'PRIVILEGE_ESCALATION_CHAIN',
    'TOOL_POISONING_CHAIN',
    'MEMORY_TO_EGRESS',
    'RAG_TO_EXTERNAL',
    'SECRET_TO_OUTPUT',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ToolChainSession" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "agentIdentityId" TEXT,
  "status" "ToolChainSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolChainSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ToolChainStep" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "toolChainSessionId" TEXT NOT NULL,
  "stepIndex" INTEGER NOT NULL,
  "tool" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "destinationType" TEXT NOT NULL,
  "dataSensitivity" TEXT NOT NULL,
  "decision" "ToolChainDecision" NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolChainStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ToolChainFinding" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "toolChainSessionId" TEXT NOT NULL,
  "findingType" "ToolChainFindingType" NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "involvedStepsJson" JSONB NOT NULL,
  "recommendation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolChainFinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ToolChainSession_projectId_sessionId_key"
  ON "ToolChainSession"("projectId", "sessionId");
CREATE INDEX IF NOT EXISTS "ToolChainSession_projectId_status_updatedAt_idx"
  ON "ToolChainSession"("projectId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "ToolChainSession_projectId_agentIdentityId_idx"
  ON "ToolChainSession"("projectId", "agentIdentityId");

CREATE UNIQUE INDEX IF NOT EXISTS "ToolChainStep_toolChainSessionId_stepIndex_key"
  ON "ToolChainStep"("toolChainSessionId", "stepIndex");
CREATE INDEX IF NOT EXISTS "ToolChainStep_projectId_createdAt_idx"
  ON "ToolChainStep"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ToolChainStep_projectId_decision_createdAt_idx"
  ON "ToolChainStep"("projectId", "decision", "createdAt");
CREATE INDEX IF NOT EXISTS "ToolChainStep_toolChainSessionId_stepIndex_idx"
  ON "ToolChainStep"("toolChainSessionId", "stepIndex");

CREATE INDEX IF NOT EXISTS "ToolChainFinding_projectId_createdAt_idx"
  ON "ToolChainFinding"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ToolChainFinding_projectId_findingType_createdAt_idx"
  ON "ToolChainFinding"("projectId", "findingType", "createdAt");
CREATE INDEX IF NOT EXISTS "ToolChainFinding_toolChainSessionId_createdAt_idx"
  ON "ToolChainFinding"("toolChainSessionId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ToolChainStep"
    ADD CONSTRAINT "ToolChainStep_toolChainSessionId_fkey"
    FOREIGN KEY ("toolChainSessionId") REFERENCES "ToolChainSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ToolChainFinding"
    ADD CONSTRAINT "ToolChainFinding_toolChainSessionId_fkey"
    FOREIGN KEY ("toolChainSessionId") REFERENCES "ToolChainSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
