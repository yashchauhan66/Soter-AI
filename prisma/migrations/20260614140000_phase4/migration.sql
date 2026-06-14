ALTER TYPE "WebhookDeliveryStatus" ADD VALUE IF NOT EXISTS 'DEAD_LETTER';

CREATE TYPE "RagDocumentStatus" AS ENUM ('SAFE', 'QUARANTINED', 'REJECTED', 'APPROVED', 'INDEXED');
CREATE TYPE "DetectionFeedbackValue" AS ENUM ('FALSE_POSITIVE', 'FALSE_NEGATIVE', 'CORRECT');
CREATE TYPE "ScheduledReportFrequency" AS ENUM ('MONTHLY');
CREATE TYPE "ScheduledReportDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "Organization" ADD COLUMN "quotaOverride" INTEGER;
ALTER TABLE "Project" ADD COLUMN "disabledAt" TIMESTAMP(3), ADD COLUMN "disabledReason" TEXT;
ALTER TABLE "ProjectPolicy" ADD COLUMN "citationRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "noSourceFallback" TEXT,
  ADD COLUMN "highRiskTopicReview" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "minSourceCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "requireSourceUrls" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WebhookEndpoint" ADD COLUMN "encryptedSecret" TEXT,
  ADD COLUMN "secretKeyVersion" TEXT,
  ADD COLUMN "secretRotatedAt" TIMESTAMP(3);
ALTER TABLE "WebhookDelivery" ADD COLUMN "deadLetteredAt" TIMESTAMP(3);

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

CREATE TABLE "RagCollection" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RagCollection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RagCollection_projectId_name_key" ON "RagCollection"("projectId", "name");
CREATE INDEX "RagCollection_organizationId_projectId_idx" ON "RagCollection"("organizationId", "projectId");

CREATE TABLE "RagDocument" (
  "id" TEXT NOT NULL, "collectionId" TEXT NOT NULL, "fileName" TEXT NOT NULL, "fileType" TEXT NOT NULL, "fileSize" INTEGER NOT NULL,
  "hash" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "status" "RagDocumentStatus" NOT NULL DEFAULT 'QUARANTINED',
  "trustScore" INTEGER NOT NULL, "riskTypes" TEXT[], "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RagDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RagDocument_collectionId_hash_version_key" ON "RagDocument"("collectionId", "hash", "version");
CREATE INDEX "RagDocument_collectionId_status_idx" ON "RagDocument"("collectionId", "status");

CREATE TABLE "RagChunk" (
  "id" TEXT NOT NULL, "documentId" TEXT NOT NULL, "chunkIndex" INTEGER NOT NULL, "textRedacted" TEXT NOT NULL,
  "hash" TEXT NOT NULL, "riskScore" INTEGER NOT NULL, "riskTypes" TEXT[], "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RagChunk_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RagChunk_documentId_chunkIndex_key" ON "RagChunk"("documentId", "chunkIndex");
CREATE INDEX "RagChunk_documentId_riskScore_idx" ON "RagChunk"("documentId", "riskScore");

CREATE TABLE "RagScanFinding" (
  "id" TEXT NOT NULL, "documentId" TEXT NOT NULL, "chunkId" TEXT, "type" TEXT NOT NULL, "severity" TEXT NOT NULL,
  "message" TEXT NOT NULL, "redactedSnippet" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RagScanFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RagScanFinding_documentId_type_idx" ON "RagScanFinding"("documentId", "type");
CREATE INDEX "RagScanFinding_chunkId_idx" ON "RagScanFinding"("chunkId");

CREATE TABLE "DetectionFeedback" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "guardLogId" TEXT NOT NULL,
  "feedback" "DetectionFeedbackValue" NOT NULL, "note" TEXT, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DetectionFeedback_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DetectionFeedback_guardLogId_createdById_key" ON "DetectionFeedback"("guardLogId", "createdById");
CREATE INDEX "DetectionFeedback_organizationId_projectId_createdAt_idx" ON "DetectionFeedback"("organizationId", "projectId", "createdAt");

CREATE TABLE "ScheduledReport" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL,
  "frequency" "ScheduledReportFrequency" NOT NULL DEFAULT 'MONTHLY', "recipients" TEXT[], "enabled" BOOLEAN NOT NULL DEFAULT true,
  "attachAuditSummary" BOOLEAN NOT NULL DEFAULT false, "lastSentAt" TIMESTAMP(3), "nextRunAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScheduledReport_projectId_frequency_key" ON "ScheduledReport"("projectId", "frequency");
CREATE INDEX "ScheduledReport_enabled_nextRunAt_idx" ON "ScheduledReport"("enabled", "nextRunAt");
CREATE INDEX "ScheduledReport_organizationId_idx" ON "ScheduledReport"("organizationId");

CREATE TABLE "ScheduledReportDelivery" (
  "id" TEXT NOT NULL, "scheduledReportId" TEXT NOT NULL, "status" "ScheduledReportDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3), "error" TEXT, "reportId" TEXT, "signature" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ScheduledReportDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScheduledReportDelivery_scheduledReportId_createdAt_idx" ON "ScheduledReportDelivery"("scheduledReportId", "createdAt");
CREATE INDEX "ScheduledReportDelivery_status_idx" ON "ScheduledReportDelivery"("status");

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL, "adminUserId" TEXT NOT NULL, "organizationId" TEXT, "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL, "reason" TEXT NOT NULL, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");
CREATE INDEX "AdminAuditLog_organizationId_createdAt_idx" ON "AdminAuditLog"("organizationId", "createdAt");
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagCollection" ADD CONSTRAINT "RagCollection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagCollection" ADD CONSTRAINT "RagCollection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagDocument" ADD CONSTRAINT "RagDocument_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "RagCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagDocument" ADD CONSTRAINT "RagDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RagChunk" ADD CONSTRAINT "RagChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RagDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagScanFinding" ADD CONSTRAINT "RagScanFinding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RagDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagScanFinding" ADD CONSTRAINT "RagScanFinding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "RagChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DetectionFeedback" ADD CONSTRAINT "DetectionFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DetectionFeedback" ADD CONSTRAINT "DetectionFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DetectionFeedback" ADD CONSTRAINT "DetectionFeedback_guardLogId_fkey" FOREIGN KEY ("guardLogId") REFERENCES "GuardLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DetectionFeedback" ADD CONSTRAINT "DetectionFeedback_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledReportDelivery" ADD CONSTRAINT "ScheduledReportDelivery_scheduledReportId_fkey" FOREIGN KEY ("scheduledReportId") REFERENCES "ScheduledReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledReportDelivery" ADD CONSTRAINT "ScheduledReportDelivery_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
