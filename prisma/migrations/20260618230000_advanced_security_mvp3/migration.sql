-- Advanced AI Security MVP 3: Agent Legal Boundary Guard

CREATE TABLE IF NOT EXISTS "LegalBoundaryPolicy" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "rulesJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalBoundaryPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LegalBoundaryCheck" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT,
  "agentName" TEXT NOT NULL,
  "websiteUrl" TEXT,
  "domain" TEXT,
  "action" TEXT,
  "actionCategory" TEXT NOT NULL,
  "userConsentProvided" BOOLEAN NOT NULL DEFAULT false,
  "riskLevel" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalBoundaryCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LegalBoundaryPolicy_projectId_enabled_idx" ON "LegalBoundaryPolicy"("projectId", "enabled");
CREATE INDEX IF NOT EXISTS "LegalBoundaryCheck_projectId_createdAt_idx" ON "LegalBoundaryCheck"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "LegalBoundaryCheck_projectId_decision_idx" ON "LegalBoundaryCheck"("projectId", "decision");
CREATE INDEX IF NOT EXISTS "LegalBoundaryCheck_projectId_domain_idx" ON "LegalBoundaryCheck"("projectId", "domain");
