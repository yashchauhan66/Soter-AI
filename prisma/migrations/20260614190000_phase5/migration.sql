ALTER TABLE "AdminAuditLog" DROP CONSTRAINT IF EXISTS "AdminAuditLog_adminUserId_fkey";
ALTER TABLE "AdminAuditLog" ALTER COLUMN "adminUserId" DROP NOT NULL;
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RagDocument" ADD COLUMN "pageCount" INTEGER,
  ADD COLUMN "extractionMethod" TEXT,
  ADD COLUMN "sandboxMetadata" JSONB;
ALTER TABLE "RagChunk" ADD COLUMN "allowedRoles" TEXT[] NOT NULL DEFAULT ARRAY['OWNER','ADMIN','DEVELOPER','SECURITY_ANALYST','BILLING','VIEWER']::TEXT[],
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sensitivityLabel" TEXT NOT NULL DEFAULT 'INTERNAL';

CREATE TABLE "RetrievalAuditLog" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "namespace" TEXT NOT NULL,
  "queryHash" TEXT NOT NULL, "requestedFilters" JSONB, "returnedChunkIds" TEXT[], "rejectedChunkIds" TEXT[],
  "resultCount" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetrievalAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RetrievalAuditLog_organizationId_projectId_createdAt_idx" ON "RetrievalAuditLog"("organizationId", "projectId", "createdAt");

CREATE TABLE "RagAnswerAuditLog" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "answerHash" TEXT NOT NULL,
  "sourceCount" INTEGER NOT NULL, "sourceCoverageScore" DOUBLE PRECISION NOT NULL, "unsupportedClaimCount" INTEGER NOT NULL,
  "fallbackUsed" BOOLEAN NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RagAnswerAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RagAnswerAuditLog_organizationId_projectId_createdAt_idx" ON "RagAnswerAuditLog"("organizationId", "projectId", "createdAt");
CREATE INDEX "RagAnswerAuditLog_fallbackUsed_createdAt_idx" ON "RagAnswerAuditLog"("fallbackUsed", "createdAt");

CREATE TABLE "ClassifierDataset" (
  "id" TEXT NOT NULL, "organizationId" TEXT, "name" TEXT NOT NULL, "version" TEXT NOT NULL, "description" TEXT,
  "isBuiltIn" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassifierDataset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClassifierDataset_organizationId_name_version_key" ON "ClassifierDataset"("organizationId", "name", "version");
CREATE TABLE "ClassifierExample" (
  "id" TEXT NOT NULL, "datasetId" TEXT NOT NULL, "text" TEXT NOT NULL, "label" TEXT NOT NULL, "language" TEXT NOT NULL DEFAULT 'en',
  "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ClassifierExample_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClassifierExample_datasetId_label_idx" ON "ClassifierExample"("datasetId", "label");
CREATE TABLE "ClassifierRun" (
  "id" TEXT NOT NULL, "organizationId" TEXT, "datasetId" TEXT NOT NULL, "detectorVersion" TEXT NOT NULL, "previousVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RUNNING', "precision" DOUBLE PRECISION, "recall" DOUBLE PRECISION, "f1" DOUBLE PRECISION,
  "falsePositiveRate" DOUBLE PRECISION, "falseNegativeRate" DOUBLE PRECISION, "calibrationError" DOUBLE PRECISION,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3), CONSTRAINT "ClassifierRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClassifierRun_organizationId_startedAt_idx" ON "ClassifierRun"("organizationId", "startedAt");
CREATE INDEX "ClassifierRun_status_startedAt_idx" ON "ClassifierRun"("status", "startedAt");
CREATE TABLE "ClassifierRunResult" (
  "id" TEXT NOT NULL, "runId" TEXT NOT NULL, "exampleId" TEXT, "expectedLabel" TEXT NOT NULL, "predictedLabel" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL, "correct" BOOLEAN NOT NULL, "riskType" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ClassifierRunResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClassifierRunResult_runId_correct_idx" ON "ClassifierRunResult"("runId", "correct");

CREATE TABLE "RedTeamSuite" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RedTeamSuite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RedTeamSuite_organizationId_projectId_idx" ON "RedTeamSuite"("organizationId", "projectId");
CREATE TABLE "RedTeamScenario" (
  "id" TEXT NOT NULL, "suiteId" TEXT NOT NULL, "key" TEXT NOT NULL, "category" TEXT NOT NULL, "severity" TEXT NOT NULL,
  "promptTemplate" TEXT NOT NULL, "expectedAction" TEXT NOT NULL, "owaspMapping" TEXT[], "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RedTeamScenario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RedTeamScenario_suiteId_key_key" ON "RedTeamScenario"("suiteId", "key");
CREATE TABLE "RedTeamRun" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "suiteId" TEXT NOT NULL,
  "confirmedByUserId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'RUNNING', "passed" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "RedTeamRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RedTeamRun_organizationId_projectId_startedAt_idx" ON "RedTeamRun"("organizationId", "projectId", "startedAt");
CREATE TABLE "RedTeamResult" (
  "id" TEXT NOT NULL, "runId" TEXT NOT NULL, "scenarioId" TEXT NOT NULL, "passed" BOOLEAN NOT NULL,
  "observedAction" TEXT NOT NULL, "riskTypes" TEXT[], "recommendation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RedTeamResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RedTeamResult_runId_passed_idx" ON "RedTeamResult"("runId", "passed");

CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT, "eventType" TEXT NOT NULL, "severity" TEXT NOT NULL,
  "riskTypes" TEXT[], "action" TEXT NOT NULL, "source" TEXT NOT NULL, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityEvent_organizationId_createdAt_idx" ON "SecurityEvent"("organizationId", "createdAt");
CREATE INDEX "SecurityEvent_projectId_createdAt_idx" ON "SecurityEvent"("projectId", "createdAt");
CREATE INDEX "SecurityEvent_eventType_severity_createdAt_idx" ON "SecurityEvent"("eventType", "severity", "createdAt");
CREATE TABLE "SiemIntegration" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "provider" TEXT NOT NULL, "name" TEXT NOT NULL, "endpointUrl" TEXT NOT NULL,
  "encryptedToken" TEXT, "tokenKeyVersion" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true, "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SiemIntegration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SiemIntegration_organizationId_enabled_idx" ON "SiemIntegration"("organizationId", "enabled");
CREATE TABLE "SiemDelivery" (
  "id" TEXT NOT NULL, "integrationId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0, "responseCode" INTEGER, "errorMessage" TEXT, "nextAttemptAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SiemDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SiemDelivery_integrationId_eventId_key" ON "SiemDelivery"("integrationId", "eventId");
CREATE INDEX "SiemDelivery_status_nextAttemptAt_idx" ON "SiemDelivery"("status", "nextAttemptAt");

CREATE TABLE "SsoProvider" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "providerType" TEXT NOT NULL DEFAULT 'SAML', "name" TEXT NOT NULL,
  "metadataUrl" TEXT, "entityId" TEXT, "ssoUrl" TEXT, "certificate" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SsoProvider_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SsoProvider_organizationId_name_key" ON "SsoProvider"("organizationId", "name");
CREATE TABLE "ScimToken" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "tokenPreview" TEXT NOT NULL,
  "createdById" TEXT, "expiresAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ScimToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScimToken_tokenHash_key" ON "ScimToken"("tokenHash");
CREATE INDEX "ScimToken_organizationId_revokedAt_idx" ON "ScimToken"("organizationId", "revokedAt");

ALTER TABLE "RetrievalAuditLog" ADD CONSTRAINT "RetrievalAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetrievalAuditLog" ADD CONSTRAINT "RetrievalAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagAnswerAuditLog" ADD CONSTRAINT "RagAnswerAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RagAnswerAuditLog" ADD CONSTRAINT "RagAnswerAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassifierDataset" ADD CONSTRAINT "ClassifierDataset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassifierExample" ADD CONSTRAINT "ClassifierExample_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ClassifierDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassifierRun" ADD CONSTRAINT "ClassifierRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassifierRun" ADD CONSTRAINT "ClassifierRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "ClassifierDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassifierRunResult" ADD CONSTRAINT "ClassifierRunResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ClassifierRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedTeamSuite" ADD CONSTRAINT "RedTeamSuite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedTeamSuite" ADD CONSTRAINT "RedTeamSuite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedTeamScenario" ADD CONSTRAINT "RedTeamScenario_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "RedTeamSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedTeamRun" ADD CONSTRAINT "RedTeamRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedTeamRun" ADD CONSTRAINT "RedTeamRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedTeamRun" ADD CONSTRAINT "RedTeamRun_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "RedTeamSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedTeamResult" ADD CONSTRAINT "RedTeamResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RedTeamRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RedTeamResult" ADD CONSTRAINT "RedTeamResult_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "RedTeamScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiemIntegration" ADD CONSTRAINT "SiemIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiemDelivery" ADD CONSTRAINT "SiemDelivery_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "SiemIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiemDelivery" ADD CONSTRAINT "SiemDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SecurityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SsoProvider" ADD CONSTRAINT "SsoProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimToken" ADD CONSTRAINT "ScimToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScimToken" ADD CONSTRAINT "ScimToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    EXECUTE 'CREATE TABLE "VectorEmbedding" (
      "id" TEXT PRIMARY KEY, "namespace" TEXT NOT NULL, "documentId" TEXT NOT NULL, "payload" JSONB NOT NULL,
      "embedding" vector(64) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )';
    CREATE INDEX "VectorEmbedding_namespace_idx" ON "VectorEmbedding"("namespace");
    CREATE INDEX "VectorEmbedding_documentId_idx" ON "VectorEmbedding"("documentId");
  ELSE
    RAISE NOTICE 'pgvector extension is unavailable; skipping VectorEmbedding because Qdrant may be used instead.';
  END IF;
END $$;
