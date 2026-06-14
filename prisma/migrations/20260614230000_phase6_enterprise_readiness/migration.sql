ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ssoOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jitProvisionedFrom" TEXT;

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "disabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "disabledReason" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "ipAllowlistEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "apiKeyRotationDays" INTEGER;

DO $$ BEGIN CREATE TYPE "MLLabel" AS ENUM ('SAFE','PROMPT_INJECTION','JAILBREAK','SYSTEM_PROMPT_LEAK_ATTEMPT','PII','SECRET','UNSAFE_OUTPUT','RAG_POISONING','DATA_EXFILTRATION_ATTEMPT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MLRolloutMode" AS ENUM ('OFF','SHADOW','PARTIAL','FULL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MLReviewKind" AS ENUM ('FALSE_POSITIVE','FALSE_NEGATIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MLReviewStatus" AS ENUM ('PENDING','RESOLVED','DISMISSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DataRetentionWindow" AS ENUM ('DAYS_7','DAYS_30','DAYS_90','DAYS_180','DAYS_365','CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DataDeletionStatus" AS ENUM ('PENDING','APPROVED','PROCESSING','COMPLETED','FAILED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DataDeletionScope" AS ENUM ('PROJECT','ORGANIZATION','GUARD_LOGS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "IntegrationProvider" AS ENUM ('SLACK','MS_TEAMS','JIRA','GITHUB'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "IntegrationDeliveryStatus" AS ENUM ('PENDING','DELIVERED','FAILED','RETRYING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MLDataset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MLDataset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MLDataset_organizationId_name_version_key" ON "MLDataset"("organizationId","name","version");
CREATE INDEX IF NOT EXISTS "MLDataset_organizationId_isActive_idx" ON "MLDataset"("organizationId","isActive");

CREATE TABLE IF NOT EXISTS "MLDatasetExample" (
  "id" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "redactedText" TEXT NOT NULL,
  "label" "MLLabel" NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MLDatasetExample_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MLDatasetExample_datasetId_label_idx" ON "MLDatasetExample"("datasetId","label");

CREATE TABLE IF NOT EXISTS "MLModelVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "backend" TEXT NOT NULL DEFAULT 'heuristic',
  "thresholds" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MLModelVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MLModelVersion_organizationId_name_version_key" ON "MLModelVersion"("organizationId","name","version");

CREATE TABLE IF NOT EXISTS "MLModelEvaluation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "modelVersionId" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "precision" DOUBLE PRECISION NOT NULL,
  "recall" DOUBLE PRECISION NOT NULL,
  "f1" DOUBLE PRECISION NOT NULL,
  "falsePositiveRate" DOUBLE PRECISION NOT NULL,
  "falseNegativeRate" DOUBLE PRECISION NOT NULL,
  "calibrationError" DOUBLE PRECISION NOT NULL,
  "perRisk" JSONB NOT NULL,
  "totalExamples" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MLModelEvaluation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MLModelEvaluation_organizationId_createdAt_idx" ON "MLModelEvaluation"("organizationId","createdAt");
CREATE INDEX IF NOT EXISTS "MLModelEvaluation_modelVersionId_createdAt_idx" ON "MLModelEvaluation"("modelVersionId","createdAt");

CREATE TABLE IF NOT EXISTS "MLModelDeployment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "modelVersionId" TEXT NOT NULL,
  "rolloutMode" "MLRolloutMode" NOT NULL DEFAULT 'OFF',
  "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
  "projectId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MLModelDeployment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MLModelDeployment_organizationId_modelVersionId_projectId_key" ON "MLModelDeployment"("organizationId","modelVersionId","projectId");
CREATE INDEX IF NOT EXISTS "MLModelDeployment_organizationId_rolloutMode_idx" ON "MLModelDeployment"("organizationId","rolloutMode");

CREATE TABLE IF NOT EXISTS "MLReviewQueue" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "modelVersionId" TEXT,
  "kind" "MLReviewKind" NOT NULL,
  "expectedLabel" "MLLabel" NOT NULL,
  "predictedLabel" "MLLabel" NOT NULL,
  "redactedText" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "status" "MLReviewStatus" NOT NULL DEFAULT 'PENDING',
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MLReviewQueue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MLReviewQueue_organizationId_status_createdAt_idx" ON "MLReviewQueue"("organizationId","status","createdAt");
CREATE INDEX IF NOT EXISTS "MLReviewQueue_modelVersionId_kind_status_idx" ON "MLReviewQueue"("modelVersionId","kind","status");

CREATE TABLE IF NOT EXISTS "SamlProvider" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "ssoUrl" TEXT NOT NULL,
  "acsUrl" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "metadataUrl" TEXT,
  "x509Certificate" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "defaultRole" "OrgRole" NOT NULL DEFAULT 'VIEWER',
  "emailDomain" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SamlProvider_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SamlProvider_organizationId_key" ON "SamlProvider"("organizationId");

CREATE TABLE IF NOT EXISTS "SamlLoginAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "providerId" TEXT,
  "email" TEXT,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SamlLoginAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SamlLoginAttempt_organizationId_createdAt_idx" ON "SamlLoginAttempt"("organizationId","createdAt");

CREATE TABLE IF NOT EXISTS "ScimUserMapping" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScimUserMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ScimUserMapping_organizationId_externalId_key" ON "ScimUserMapping"("organizationId","externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScimUserMapping_organizationId_userId_key" ON "ScimUserMapping"("organizationId","userId");
CREATE INDEX IF NOT EXISTS "ScimUserMapping_organizationId_active_idx" ON "ScimUserMapping"("organizationId","active");

CREATE TABLE IF NOT EXISTS "ScimGroupMapping" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "OrgRole" NOT NULL DEFAULT 'VIEWER',
  "members" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScimGroupMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ScimGroupMapping_organizationId_externalId_key" ON "ScimGroupMapping"("organizationId","externalId");
CREATE INDEX IF NOT EXISTS "ScimGroupMapping_organizationId_idx" ON "ScimGroupMapping"("organizationId");

CREATE TABLE IF NOT EXISTS "RetentionPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "window" "DataRetentionWindow" NOT NULL DEFAULT 'DAYS_30',
  "customDays" INTEGER,
  "applyToLogs" BOOLEAN NOT NULL DEFAULT true,
  "applyToWebhookDeliveries" BOOLEAN NOT NULL DEFAULT false,
  "applyToSecurityEvents" BOOLEAN NOT NULL DEFAULT false,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RetentionPolicy_organizationId_key" ON "RetentionPolicy"("organizationId");

CREATE TABLE IF NOT EXISTS "DataDeletionRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "scope" "DataDeletionScope" NOT NULL,
  "projectId" TEXT,
  "requestedById" TEXT,
  "status" "DataDeletionStatus" NOT NULL DEFAULT 'PENDING',
  "confirmation" TEXT NOT NULL,
  "exportRequested" BOOLEAN NOT NULL DEFAULT false,
  "exportId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DataDeletionRequest_organizationId_status_createdAt_idx" ON "DataDeletionRequest"("organizationId","status","createdAt");

CREATE TABLE IF NOT EXISTS "DataDeletionJob" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "status" "DataDeletionStatus" NOT NULL DEFAULT 'PENDING',
  "itemsDeleted" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataDeletionJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DataDeletionJob_requestId_status_idx" ON "DataDeletionJob"("requestId","status");

CREATE TABLE IF NOT EXISTS "Integration" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "encryptedConfig" JSONB NOT NULL,
  "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Integration_organizationId_provider_name_key" ON "Integration"("organizationId","provider","name");
CREATE INDEX IF NOT EXISTS "Integration_organizationId_enabled_idx" ON "Integration"("organizationId","enabled");

CREATE TABLE IF NOT EXISTS "IntegrationEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "redactedPayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IntegrationEvent_organizationId_createdAt_idx" ON "IntegrationEvent"("organizationId","createdAt");

CREATE TABLE IF NOT EXISTS "IntegrationDelivery" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "status" "IntegrationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "responseCode" INTEGER,
  "errorMessage" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationDelivery_integrationId_eventId_key" ON "IntegrationDelivery"("integrationId","eventId");
CREATE INDEX IF NOT EXISTS "IntegrationDelivery_status_createdAt_idx" ON "IntegrationDelivery"("status","createdAt");

CREATE TABLE IF NOT EXISTS "IpAllowlistEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "cidr" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IpAllowlistEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IpAllowlistEntry_organizationId_cidr_key" ON "IpAllowlistEntry"("organizationId","cidr");

CREATE TABLE IF NOT EXISTS "UserSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "UserSession_userId_revokedAt_idx" ON "UserSession"("userId","revokedAt");
CREATE INDEX IF NOT EXISTS "UserSession_organizationId_idx" ON "UserSession"("organizationId");

CREATE TABLE IF NOT EXISTS "OrganizationAuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "metadata" JSONB,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrganizationAuditLog_organizationId_createdAt_idx" ON "OrganizationAuditLog"("organizationId","createdAt");
CREATE INDEX IF NOT EXISTS "OrganizationAuditLog_category_createdAt_idx" ON "OrganizationAuditLog"("category","createdAt");

ALTER TABLE "MLDataset" ADD CONSTRAINT "MLDataset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MLDatasetExample" ADD CONSTRAINT "MLDatasetExample_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "MLDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MLModelVersion" ADD CONSTRAINT "MLModelVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MLModelEvaluation" ADD CONSTRAINT "MLModelEvaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MLModelEvaluation" ADD CONSTRAINT "MLModelEvaluation_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "MLModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MLModelEvaluation" ADD CONSTRAINT "MLModelEvaluation_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "MLDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MLModelDeployment" ADD CONSTRAINT "MLModelDeployment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MLModelDeployment" ADD CONSTRAINT "MLModelDeployment_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "MLModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MLReviewQueue" ADD CONSTRAINT "MLReviewQueue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MLReviewQueue" ADD CONSTRAINT "MLReviewQueue_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "MLModelVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MLReviewQueue" ADD CONSTRAINT "MLReviewQueue_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SamlProvider" ADD CONSTRAINT "SamlProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SamlLoginAttempt" ADD CONSTRAINT "SamlLoginAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SamlLoginAttempt" ADD CONSTRAINT "SamlLoginAttempt_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "SamlProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScimUserMapping" ADD CONSTRAINT "ScimUserMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimUserMapping" ADD CONSTRAINT "ScimUserMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimGroupMapping" ADD CONSTRAINT "ScimGroupMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataDeletionRequest" ADD CONSTRAINT "DataDeletionRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataDeletionRequest" ADD CONSTRAINT "DataDeletionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataDeletionJob" ADD CONSTRAINT "DataDeletionJob_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DataDeletionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationDelivery" ADD CONSTRAINT "IntegrationDelivery_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationDelivery" ADD CONSTRAINT "IntegrationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "IntegrationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IpAllowlistEntry" ADD CONSTRAINT "IpAllowlistEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationAuditLog" ADD CONSTRAINT "OrganizationAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
