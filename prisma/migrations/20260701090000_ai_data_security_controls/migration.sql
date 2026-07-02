CREATE TYPE "CompanyFingerprintCategory" AS ENUM (
  'customer_list', 'legal_contract', 'investor_deck', 'salary_sheet', 'source_code',
  'product_roadmap', 'internal_policy', 'support_export', 'financial_report',
  'database_export', 'confidential_notes', 'custom'
);

CREATE TYPE "CompanyFingerprintSensitivity" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "CompanyFingerprintAction" AS ENUM ('warn', 'redact', 'rewrite', 'block', 'require_justification', 'require_approval');
CREATE TYPE "CompanyFingerprintStorageMode" AS ENUM ('hashed_only', 'encrypted_raw_allowed');
CREATE TYPE "CompanyFingerprintSourceType" AS ENUM ('manual_text', 'uploaded_file', 'api_import', 'connector_import');
CREATE TYPE "CompanyFingerprintMatchType" AS ENUM ('exact', 'fuzzy', 'semantic');
CREATE TYPE "DataLineageEventType" AS ENUM ('copy', 'paste_to_ai', 'upload_to_ai', 'submit_to_ai', 'response_scan', 'approval_request');

CREATE TABLE "CompanyFingerprintSet" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "CompanyFingerprintCategory" NOT NULL,
  "sensitivity" "CompanyFingerprintSensitivity" NOT NULL,
  "ownerDepartment" TEXT,
  "action" "CompanyFingerprintAction" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "storageMode" "CompanyFingerprintStorageMode" NOT NULL DEFAULT 'hashed_only',
  "sourceType" "CompanyFingerprintSourceType" NOT NULL,
  "originalFileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "retentionDays" INTEGER,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "lastMatchedAt" TIMESTAMP(3),
  CONSTRAINT "CompanyFingerprintSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyFingerprintChunk" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fingerprintSetId" TEXT NOT NULL,
  "chunkHash" TEXT NOT NULL,
  "shingleHash" TEXT,
  "chunkIndex" INTEGER NOT NULL,
  "algorithm" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyFingerprintChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyFingerprintMatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fingerprintSetId" TEXT NOT NULL,
  "employeeId" TEXT,
  "deviceId" TEXT,
  "destinationDomain" TEXT NOT NULL,
  "sourceApp" TEXT,
  "sourceUrl" TEXT,
  "matchType" "CompanyFingerprintMatchType" NOT NULL,
  "similarityScore" DOUBLE PRECISION NOT NULL,
  "confidence" "CompanyFingerprintSensitivity" NOT NULL,
  "actionTaken" TEXT NOT NULL,
  "redactedPreview" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyFingerprintMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataLineageEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT,
  "deviceId" TEXT,
  "sourceDomain" TEXT,
  "sourceApp" TEXT NOT NULL,
  "sourceCategory" TEXT NOT NULL,
  "sourceUrlHash" TEXT,
  "sourceTitle" TEXT,
  "destinationDomain" TEXT NOT NULL,
  "destinationApp" TEXT NOT NULL,
  "destinationCategory" TEXT NOT NULL,
  "dataTypes" TEXT[],
  "riskScore" INTEGER NOT NULL,
  "severity" TEXT NOT NULL,
  "actionTaken" TEXT NOT NULL,
  "policyId" TEXT,
  "fingerprintSetId" TEXT,
  "approvalRequestId" TEXT,
  "redactedPreview" TEXT,
  "eventType" "DataLineageEventType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataLineageEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceAppConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domains" TEXT[],
  "category" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sensitivity" TEXT NOT NULL DEFAULT 'medium',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceAppConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIFileScanEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT,
  "deviceId" TEXT,
  "destinationDomain" TEXT NOT NULL,
  "sourceApp" TEXT,
  "fileNameHash" TEXT NOT NULL,
  "originalExtension" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER NOT NULL,
  "scannedBytes" INTEGER NOT NULL,
  "supported" BOOLEAN NOT NULL,
  "encryptedOrBinary" BOOLEAN NOT NULL DEFAULT false,
  "detectedDataTypes" TEXT[],
  "fingerprintSetId" TEXT,
  "riskScore" INTEGER NOT NULL,
  "severity" TEXT NOT NULL,
  "actionTaken" TEXT NOT NULL,
  "redactedPreview" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIFileScanEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompanyFingerprintSet" ADD CONSTRAINT "CompanyFingerprintSet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyFingerprintSet" ADD CONSTRAINT "CompanyFingerprintSet_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyFingerprintChunk" ADD CONSTRAINT "CompanyFingerprintChunk_fingerprintSetId_fkey" FOREIGN KEY ("fingerprintSetId") REFERENCES "CompanyFingerprintSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyFingerprintMatch" ADD CONSTRAINT "CompanyFingerprintMatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyFingerprintMatch" ADD CONSTRAINT "CompanyFingerprintMatch_fingerprintSetId_fkey" FOREIGN KEY ("fingerprintSetId") REFERENCES "CompanyFingerprintSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataLineageEvent" ADD CONSTRAINT "DataLineageEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceAppConfig" ADD CONSTRAINT "SourceAppConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIFileScanEvent" ADD CONSTRAINT "AIFileScanEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CompanyFingerprintSet_organizationId_enabled_deletedAt_idx" ON "CompanyFingerprintSet"("organizationId", "enabled", "deletedAt");
CREATE INDEX "CompanyFingerprintSet_organizationId_category_idx" ON "CompanyFingerprintSet"("organizationId", "category");
CREATE INDEX "CompanyFingerprintSet_organizationId_sensitivity_idx" ON "CompanyFingerprintSet"("organizationId", "sensitivity");
CREATE INDEX "CompanyFingerprintSet_organizationId_ownerDepartment_idx" ON "CompanyFingerprintSet"("organizationId", "ownerDepartment");
CREATE INDEX "CompanyFingerprintChunk_organizationId_chunkHash_idx" ON "CompanyFingerprintChunk"("organizationId", "chunkHash");
CREATE INDEX "CompanyFingerprintChunk_organizationId_shingleHash_idx" ON "CompanyFingerprintChunk"("organizationId", "shingleHash");
CREATE INDEX "CompanyFingerprintChunk_fingerprintSetId_idx" ON "CompanyFingerprintChunk"("fingerprintSetId");
CREATE INDEX "CompanyFingerprintMatch_organizationId_createdAt_idx" ON "CompanyFingerprintMatch"("organizationId", "createdAt");
CREATE INDEX "CompanyFingerprintMatch_fingerprintSetId_createdAt_idx" ON "CompanyFingerprintMatch"("fingerprintSetId", "createdAt");
CREATE INDEX "CompanyFingerprintMatch_organizationId_employeeId_createdAt_idx" ON "CompanyFingerprintMatch"("organizationId", "employeeId", "createdAt");
CREATE INDEX "DataLineageEvent_organizationId_createdAt_idx" ON "DataLineageEvent"("organizationId", "createdAt");
CREATE INDEX "DataLineageEvent_organizationId_employeeId_createdAt_idx" ON "DataLineageEvent"("organizationId", "employeeId", "createdAt");
CREATE INDEX "DataLineageEvent_organizationId_sourceApp_createdAt_idx" ON "DataLineageEvent"("organizationId", "sourceApp", "createdAt");
CREATE INDEX "DataLineageEvent_organizationId_destinationApp_createdAt_idx" ON "DataLineageEvent"("organizationId", "destinationApp", "createdAt");
CREATE INDEX "SourceAppConfig_organizationId_enabled_idx" ON "SourceAppConfig"("organizationId", "enabled");
CREATE INDEX "SourceAppConfig_organizationId_category_idx" ON "SourceAppConfig"("organizationId", "category");
CREATE INDEX "AIFileScanEvent_organizationId_createdAt_idx" ON "AIFileScanEvent"("organizationId", "createdAt");
CREATE INDEX "AIFileScanEvent_organizationId_employeeId_createdAt_idx" ON "AIFileScanEvent"("organizationId", "employeeId", "createdAt");
CREATE INDEX "AIFileScanEvent_organizationId_originalExtension_createdAt_idx" ON "AIFileScanEvent"("organizationId", "originalExtension", "createdAt");
