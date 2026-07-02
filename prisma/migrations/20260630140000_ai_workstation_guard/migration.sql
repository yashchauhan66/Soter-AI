CREATE TABLE "AIDestination" (
  "id" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "urlPatterns" TEXT[],
  "domains" TEXT[],
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "riskLevel" TEXT NOT NULL,
  "allowedDepartments" TEXT[],
  "allowedRoles" TEXT[],
  "policyOverrides" JSONB NOT NULL,
  "responseScanningEnabled" BOOLEAN NOT NULL DEFAULT true,
  "loggingMode" TEXT NOT NULL DEFAULT 'metadata_only',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIDestination_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DeviceAgent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "employeeId" TEXT,
  "deviceId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "lastHeartbeatAt" TIMESTAMP(3),
  "policyVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "activeDestination" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceAgent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIDestination_organizationId_destinationId_key" ON "AIDestination"("organizationId", "destinationId");
CREATE INDEX "AIDestination_organizationId_category_enabled_idx" ON "AIDestination"("organizationId", "category", "enabled");
CREATE UNIQUE INDEX "DeviceAgent_organizationId_deviceId_type_key" ON "DeviceAgent"("organizationId", "deviceId", "type");
CREATE INDEX "DeviceAgent_organizationId_status_lastHeartbeatAt_idx" ON "DeviceAgent"("organizationId", "status", "lastHeartbeatAt");
CREATE INDEX "DeviceAgent_employeeId_idx" ON "DeviceAgent"("employeeId");
ALTER TABLE "AIDestination" ADD CONSTRAINT "AIDestination_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceAgent" ADD CONSTRAINT "DeviceAgent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
