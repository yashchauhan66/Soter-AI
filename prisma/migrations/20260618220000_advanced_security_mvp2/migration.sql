-- Advanced AI Security MVP 2: Memory Poisoning Detector + MCP Tool Drift Monitor

CREATE TABLE IF NOT EXISTS "AgentMemoryRecord" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT,
  "agentName" TEXT NOT NULL,
  "memoryScope" TEXT NOT NULL,
  "memoryType" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "contentRedacted" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "riskLevel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentMemoryRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MemoryPoisoningFinding" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "memoryRecordId" TEXT NOT NULL,
  "findingType" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "recommendedAction" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoryPoisoningFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MemoryChangeAudit" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "memoryRecordId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforeHash" TEXT,
  "afterHash" TEXT,
  "decision" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemoryChangeAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "McpServerRegistry" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "serverName" TEXT NOT NULL,
  "serverUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "trustLevel" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "McpServerRegistry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "McpToolSnapshot" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "toolDescriptionHash" TEXT NOT NULL,
  "inputSchemaHash" TEXT NOT NULL,
  "outputSchemaHash" TEXT,
  "endpointHash" TEXT,
  "toolDescriptionRedacted" TEXT,
  "inputSchemaJson" JSONB,
  "outputSchemaJson" JSONB,
  "detectedCapabilitiesJson" JSONB NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "riskReasonsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "McpToolSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "McpToolDrift" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "previousSnapshotId" TEXT,
  "currentSnapshotId" TEXT,
  "driftType" TEXT NOT NULL,
  "riskBefore" TEXT NOT NULL,
  "riskAfter" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "McpToolDrift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentMemoryRecord_projectId_status_createdAt_idx" ON "AgentMemoryRecord"("projectId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentMemoryRecord_projectId_agentName_idx" ON "AgentMemoryRecord"("projectId", "agentName");
CREATE INDEX IF NOT EXISTS "MemoryPoisoningFinding_projectId_createdAt_idx" ON "MemoryPoisoningFinding"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "MemoryPoisoningFinding_memoryRecordId_idx" ON "MemoryPoisoningFinding"("memoryRecordId");
CREATE INDEX IF NOT EXISTS "MemoryChangeAudit_projectId_createdAt_idx" ON "MemoryChangeAudit"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "MemoryChangeAudit_memoryRecordId_idx" ON "MemoryChangeAudit"("memoryRecordId");
CREATE UNIQUE INDEX IF NOT EXISTS "McpServerRegistry_projectId_serverName_key" ON "McpServerRegistry"("projectId", "serverName");
CREATE INDEX IF NOT EXISTS "McpServerRegistry_projectId_status_idx" ON "McpServerRegistry"("projectId", "status");
CREATE INDEX IF NOT EXISTS "McpToolSnapshot_projectId_serverId_createdAt_idx" ON "McpToolSnapshot"("projectId", "serverId", "createdAt");
CREATE INDEX IF NOT EXISTS "McpToolSnapshot_projectId_toolName_idx" ON "McpToolSnapshot"("projectId", "toolName");
CREATE INDEX IF NOT EXISTS "McpToolDrift_projectId_status_createdAt_idx" ON "McpToolDrift"("projectId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "McpToolDrift_projectId_serverId_idx" ON "McpToolDrift"("projectId", "serverId");
