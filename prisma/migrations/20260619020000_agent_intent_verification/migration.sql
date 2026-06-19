-- Feature 2: Agent Intent Verification Engine

DO $$ BEGIN
  CREATE TYPE "AgentIntentDecision" AS ENUM ('ALLOW', 'BLOCK', 'ASK_APPROVAL', 'REVIEW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AgentIntentRecord" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userPromptHash" TEXT NOT NULL,
  "userPromptRedacted" TEXT NOT NULL,
  "extractedIntentJson" JSONB NOT NULL,
  "allowedIntentCategoriesJson" JSONB NOT NULL,
  "forbiddenIntentCategoriesJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentIntentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentIntentActionCheck" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "intentRecordId" TEXT NOT NULL,
  "tool" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "actionDescription" TEXT,
  "intentMatchScore" DOUBLE PRECISION NOT NULL,
  "decision" "AgentIntentDecision" NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentIntentActionCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentIntentRecord_projectId_sessionId_createdAt_idx"
  ON "AgentIntentRecord"("projectId", "sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentIntentRecord_projectId_userPromptHash_idx"
  ON "AgentIntentRecord"("projectId", "userPromptHash");

CREATE INDEX IF NOT EXISTS "AgentIntentActionCheck_projectId_sessionId_createdAt_idx"
  ON "AgentIntentActionCheck"("projectId", "sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentIntentActionCheck_projectId_decision_createdAt_idx"
  ON "AgentIntentActionCheck"("projectId", "decision", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentIntentActionCheck_intentRecordId_createdAt_idx"
  ON "AgentIntentActionCheck"("intentRecordId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AgentIntentActionCheck"
    ADD CONSTRAINT "AgentIntentActionCheck_intentRecordId_fkey"
    FOREIGN KEY ("intentRecordId") REFERENCES "AgentIntentRecord"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
