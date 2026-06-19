-- Feature 6: Semantic Data Egress Firewall

DO $$ BEGIN
  CREATE TYPE "SemanticEgressDecision" AS ENUM ('ALLOW', 'BLOCK', 'REDACT', 'ASK_APPROVAL', 'REVIEW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "SemanticSourceFingerprint" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sensitivityLevel" TEXT NOT NULL,
  "fingerprintJson" JSONB NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SemanticSourceFingerprint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SemanticSourceFingerprint_projectId_sourceId_key"
  ON "SemanticSourceFingerprint"("projectId", "sourceId");
CREATE INDEX IF NOT EXISTS "SemanticSourceFingerprint_projectId_sensitivityLevel_createdAt_idx"
  ON "SemanticSourceFingerprint"("projectId", "sensitivityLevel", "createdAt");
CREATE INDEX IF NOT EXISTS "SemanticSourceFingerprint_projectId_sourceType_createdAt_idx"
  ON "SemanticSourceFingerprint"("projectId", "sourceType", "createdAt");

CREATE TABLE IF NOT EXISTS "SemanticEgressCheck" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sourceIdsJson" JSONB NOT NULL,
  "destinationType" TEXT NOT NULL,
  "destinationName" TEXT,
  "contentHash" TEXT NOT NULL,
  "contentRedacted" TEXT NOT NULL,
  "semanticRiskScore" DOUBLE PRECISION NOT NULL,
  "decision" "SemanticEgressDecision" NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "findingsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SemanticEgressCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SemanticEgressCheck_projectId_sessionId_createdAt_idx"
  ON "SemanticEgressCheck"("projectId", "sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "SemanticEgressCheck_projectId_decision_createdAt_idx"
  ON "SemanticEgressCheck"("projectId", "decision", "createdAt");
CREATE INDEX IF NOT EXISTS "SemanticEgressCheck_projectId_riskLevel_createdAt_idx"
  ON "SemanticEgressCheck"("projectId", "riskLevel", "createdAt");
