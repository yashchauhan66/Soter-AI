-- Feature 1: AI Agent Identity & Session Passport

DO $$ BEGIN
  CREATE TYPE "AgentIdentityType" AS ENUM (
    'CHATBOT',
    'RAG_AGENT',
    'COMPUTER_USE',
    'BROWSER_AGENT',
    'MCP_AGENT',
    'CODING_AGENT',
    'CUSTOM'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentIdentityStatus" AS ENUM ('ACTIVE', 'DISABLED', 'QUARANTINED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentSessionPassportStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AgentIdentity" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "agentType" "AgentIdentityType" NOT NULL,
  "description" TEXT,
  "status" "AgentIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
  "defaultPolicyJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentSessionPassport" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "agentIdentityId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "passportHash" TEXT NOT NULL,
  "status" "AgentSessionPassportStatus" NOT NULL DEFAULT 'ACTIVE',
  "allowedToolsJson" JSONB NOT NULL,
  "blockedToolsJson" JSONB NOT NULL,
  "approvalRequiredToolsJson" JSONB NOT NULL,
  "allowedDomainsJson" JSONB NOT NULL,
  "blockedDomainsJson" JSONB NOT NULL,
  "dataScopesJson" JSONB NOT NULL,
  "memoryScopesJson" JSONB NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentSessionPassport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentPassportAudit" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "agentIdentityId" TEXT NOT NULL,
  "sessionPassportId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentPassportAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentIdentity_projectId_name_key" ON "AgentIdentity"("projectId", "name");
CREATE INDEX IF NOT EXISTS "AgentIdentity_projectId_status_idx" ON "AgentIdentity"("projectId", "status");
CREATE INDEX IF NOT EXISTS "AgentIdentity_projectId_agentType_idx" ON "AgentIdentity"("projectId", "agentType");

CREATE UNIQUE INDEX IF NOT EXISTS "AgentSessionPassport_passportHash_key" ON "AgentSessionPassport"("passportHash");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentSessionPassport_projectId_sessionId_key" ON "AgentSessionPassport"("projectId", "sessionId");
CREATE INDEX IF NOT EXISTS "AgentSessionPassport_projectId_status_expiresAt_idx" ON "AgentSessionPassport"("projectId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "AgentSessionPassport_projectId_agentIdentityId_idx" ON "AgentSessionPassport"("projectId", "agentIdentityId");
CREATE INDEX IF NOT EXISTS "AgentSessionPassport_sessionId_idx" ON "AgentSessionPassport"("sessionId");

CREATE INDEX IF NOT EXISTS "AgentPassportAudit_projectId_createdAt_idx" ON "AgentPassportAudit"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentPassportAudit_projectId_agentIdentityId_idx" ON "AgentPassportAudit"("projectId", "agentIdentityId");
CREATE INDEX IF NOT EXISTS "AgentPassportAudit_sessionPassportId_createdAt_idx" ON "AgentPassportAudit"("sessionPassportId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentPassportAudit_decision_createdAt_idx" ON "AgentPassportAudit"("decision", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AgentSessionPassport"
    ADD CONSTRAINT "AgentSessionPassport_agentIdentityId_fkey"
    FOREIGN KEY ("agentIdentityId") REFERENCES "AgentIdentity"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AgentPassportAudit"
    ADD CONSTRAINT "AgentPassportAudit_agentIdentityId_fkey"
    FOREIGN KEY ("agentIdentityId") REFERENCES "AgentIdentity"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AgentPassportAudit"
    ADD CONSTRAINT "AgentPassportAudit_sessionPassportId_fkey"
    FOREIGN KEY ("sessionPassportId") REFERENCES "AgentSessionPassport"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
