CREATE TABLE IF NOT EXISTS "AiAdminPolicy" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "mode" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "scope" JSONB NOT NULL,
  "destinations" JSONB NOT NULL,
  "detectionConfig" JSONB NOT NULL,
  "logMode" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "updatedBy" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AiAdminPolicyTemplate" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "defaultSeverity" TEXT NOT NULL,
  "defaultAction" TEXT NOT NULL,
  "detectorKeys" TEXT[] NOT NULL,
  "enabledByDefault" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AiAdminPolicyVersion" (
  "id" TEXT PRIMARY KEY,
  "policyId" TEXT NOT NULL REFERENCES "AiAdminPolicy"("id") ON DELETE CASCADE,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "publishedBy" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rollbackFromVersion" INTEGER
);

CREATE TABLE IF NOT EXISTS "AiAdminPolicyAuditLog" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "adminUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "policyId" TEXT REFERENCES "AiAdminPolicy"("id") ON DELETE SET NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AiAdminPolicy_organizationId_enabled_idx" ON "AiAdminPolicy"("organizationId", "enabled");
CREATE INDEX IF NOT EXISTS "AiAdminPolicy_organizationId_version_idx" ON "AiAdminPolicy"("organizationId", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "AiAdminPolicyTemplate_organizationId_key_key" ON "AiAdminPolicyTemplate"("organizationId", "key");
CREATE INDEX IF NOT EXISTS "AiAdminPolicyTemplate_category_idx" ON "AiAdminPolicyTemplate"("category");
CREATE UNIQUE INDEX IF NOT EXISTS "AiAdminPolicyVersion_policyId_version_key" ON "AiAdminPolicyVersion"("policyId", "version");
CREATE INDEX IF NOT EXISTS "AiAdminPolicyVersion_organizationId_publishedAt_idx" ON "AiAdminPolicyVersion"("organizationId", "publishedAt");
CREATE INDEX IF NOT EXISTS "AiAdminPolicyAuditLog_organizationId_createdAt_idx" ON "AiAdminPolicyAuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiAdminPolicyAuditLog_policyId_createdAt_idx" ON "AiAdminPolicyAuditLog"("policyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiAdminPolicyAuditLog_adminUserId_createdAt_idx" ON "AiAdminPolicyAuditLog"("adminUserId", "createdAt");
