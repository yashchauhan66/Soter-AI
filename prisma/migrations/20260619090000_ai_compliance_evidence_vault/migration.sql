-- Feature 9: AI Compliance Evidence Vault

DO $$ BEGIN
  CREATE TYPE "ComplianceEvidenceType" AS ENUM (
    'POLICY',
    'GUARD_DECISION',
    'REDACTION',
    'APPROVAL',
    'INCIDENT',
    'RAG_SCAN',
    'AGENT_PASSPORT',
    'TOOL_CHAIN',
    'CANARY',
    'RED_TEAM',
    'DATA_FLOW',
    'COST_CONTROL',
    'CUSTOM'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ComplianceEvidenceStatus" AS ENUM ('ACTIVE', 'PASS', 'FAIL', 'WARNING', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ComplianceEvidenceReportType" AS ENUM (
    'SECURITY_POSTURE',
    'INCIDENT_SUMMARY',
    'CUSTOMER_TRUST',
    'AUDIT_EXPORT',
    'AI_RISK_REVIEW'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ComplianceEvidenceReportStatus" AS ENUM ('DRAFT', 'GENERATED', 'EXPORTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ComplianceEvidenceItem" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "evidenceType" "ComplianceEvidenceType" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "riskLevel" TEXT,
  "controlName" TEXT NOT NULL,
  "status" "ComplianceEvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
  "evidenceJson" JSONB NOT NULL,
  "contentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceEvidenceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ComplianceEvidenceItem_projectId_createdAt_idx"
  ON "ComplianceEvidenceItem"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ComplianceEvidenceItem_projectId_evidenceType_createdAt_idx"
  ON "ComplianceEvidenceItem"("projectId", "evidenceType", "createdAt");
CREATE INDEX IF NOT EXISTS "ComplianceEvidenceItem_projectId_status_createdAt_idx"
  ON "ComplianceEvidenceItem"("projectId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ComplianceEvidenceItem_projectId_controlName_idx"
  ON "ComplianceEvidenceItem"("projectId", "controlName");

CREATE TABLE IF NOT EXISTS "ComplianceEvidenceReport" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "reportName" TEXT NOT NULL,
  "reportType" "ComplianceEvidenceReportType" NOT NULL,
  "status" "ComplianceEvidenceReportStatus" NOT NULL DEFAULT 'DRAFT',
  "summary" TEXT NOT NULL,
  "evidenceIdsJson" JSONB NOT NULL,
  "reportJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceEvidenceReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ComplianceEvidenceReport_projectId_createdAt_idx"
  ON "ComplianceEvidenceReport"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ComplianceEvidenceReport_projectId_reportType_createdAt_idx"
  ON "ComplianceEvidenceReport"("projectId", "reportType", "createdAt");
CREATE INDEX IF NOT EXISTS "ComplianceEvidenceReport_projectId_status_createdAt_idx"
  ON "ComplianceEvidenceReport"("projectId", "status", "createdAt");
