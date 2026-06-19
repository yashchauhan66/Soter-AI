-- Feature 4: Agent Transaction Escrow

DO $$ BEGIN
  CREATE TYPE "AgentEscrowTransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'EXECUTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentEscrowActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AgentEscrowTransaction" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "agentIdentityId" TEXT,
  "transactionType" TEXT NOT NULL,
  "tool" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "originalPayloadRedacted" TEXT,
  "safePayload" TEXT,
  "riskLevel" TEXT NOT NULL,
  "status" "AgentEscrowTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "approvalTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentEscrowTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentEscrowAudit" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "escrowTransactionId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorType" "AgentEscrowActorType" NOT NULL,
  "reason" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentEscrowAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentEscrowTransaction_approvalTokenHash_key"
  ON "AgentEscrowTransaction"("approvalTokenHash");
CREATE INDEX IF NOT EXISTS "AgentEscrowTransaction_projectId_sessionId_createdAt_idx"
  ON "AgentEscrowTransaction"("projectId", "sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentEscrowTransaction_projectId_status_expiresAt_idx"
  ON "AgentEscrowTransaction"("projectId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "AgentEscrowTransaction_projectId_agentIdentityId_idx"
  ON "AgentEscrowTransaction"("projectId", "agentIdentityId");

CREATE INDEX IF NOT EXISTS "AgentEscrowAudit_projectId_createdAt_idx"
  ON "AgentEscrowAudit"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentEscrowAudit_projectId_actorType_createdAt_idx"
  ON "AgentEscrowAudit"("projectId", "actorType", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentEscrowAudit_escrowTransactionId_createdAt_idx"
  ON "AgentEscrowAudit"("escrowTransactionId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AgentEscrowAudit"
    ADD CONSTRAINT "AgentEscrowAudit_escrowTransactionId_fkey"
    FOREIGN KEY ("escrowTransactionId") REFERENCES "AgentEscrowTransaction"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
