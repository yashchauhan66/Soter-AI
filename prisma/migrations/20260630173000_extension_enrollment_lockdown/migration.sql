CREATE TABLE "ExtensionEnrollmentToken" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdByAdminId" TEXT NOT NULL,
  "employeeEmail" TEXT,
  "department" TEXT,
  "role" TEXT,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExtensionEnrollmentToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExtensionEnrollmentToken_usage_check" CHECK ("maxUses" > 0 AND "usedCount" >= 0 AND "usedCount" <= "maxUses")
);

CREATE UNIQUE INDEX "ExtensionEnrollmentToken_tokenHash_key" ON "ExtensionEnrollmentToken"("tokenHash");
CREATE INDEX "ExtensionEnrollmentToken_organizationId_idx" ON "ExtensionEnrollmentToken"("organizationId");
CREATE INDEX "ExtensionEnrollmentToken_tokenHash_idx" ON "ExtensionEnrollmentToken"("tokenHash");
CREATE INDEX "ExtensionEnrollmentToken_expiresAt_idx" ON "ExtensionEnrollmentToken"("expiresAt");

ALTER TABLE "ExtensionEnrollmentToken" ADD CONSTRAINT "ExtensionEnrollmentToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtensionEnrollmentToken" ADD CONSTRAINT "ExtensionEnrollmentToken_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EmergencyLockdownState" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "enabledByAdminId" TEXT,
  "enabledAt" TIMESTAMP(3),
  "disabledByAdminId" TEXT,
  "disabledAt" TIMESTAMP(3),
  "reason" TEXT,
  "policyVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyLockdownState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmergencyLockdownState_organizationId_key" ON "EmergencyLockdownState"("organizationId");
CREATE INDEX "EmergencyLockdownState_organizationId_idx" ON "EmergencyLockdownState"("organizationId");
CREATE INDEX "EmergencyLockdownState_enabled_idx" ON "EmergencyLockdownState"("enabled");

ALTER TABLE "EmergencyLockdownState" ADD CONSTRAINT "EmergencyLockdownState_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyLockdownState" ADD CONSTRAINT "EmergencyLockdownState_enabledByAdminId_fkey"
  FOREIGN KEY ("enabledByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyLockdownState" ADD CONSTRAINT "EmergencyLockdownState_disabledByAdminId_fkey"
  FOREIGN KEY ("disabledByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeviceAgent"
  ADD COLUMN "employeeEmail" TEXT,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "role" TEXT,
  ADD COLUMN "deviceTokenHash" TEXT,
  ADD COLUMN "lockdownEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "DeviceAgent_deviceTokenHash_key" ON "DeviceAgent"("deviceTokenHash");
