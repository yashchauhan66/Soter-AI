CREATE TABLE IF NOT EXISTS "McpToolScan" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "serverName" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "toolSchemaJson" JSONB,
  "detectedCapabilitiesJson" JSONB NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "riskReasonsJson" JSONB NOT NULL,
  "recommendedPolicyJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "McpToolScan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentMemoryEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "projectId" TEXT NOT NULL,
  "memoryType" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "contentRedacted" TEXT,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentMemoryEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RagDocumentTrust" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "trustScore" INTEGER NOT NULL,
  "trustLevel" TEXT NOT NULL,
  "findingsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RagDocumentTrust_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CanaryToken" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenLabel" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "triggeredAt" TIMESTAMP(3),
  CONSTRAINT "CanaryToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentReplay" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "replayJson" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentReplay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "McpToolScan_projectId_createdAt_idx" ON "McpToolScan"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "McpToolScan_projectId_serverName_idx" ON "McpToolScan"("projectId", "serverName");
CREATE INDEX IF NOT EXISTS "AgentMemoryEvent_projectId_createdAt_idx" ON "AgentMemoryEvent"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentMemoryEvent_sessionId_createdAt_idx" ON "AgentMemoryEvent"("sessionId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "RagDocumentTrust_projectId_documentId_key" ON "RagDocumentTrust"("projectId", "documentId");
CREATE INDEX IF NOT EXISTS "RagDocumentTrust_projectId_trustLevel_idx" ON "RagDocumentTrust"("projectId", "trustLevel");
CREATE UNIQUE INDEX IF NOT EXISTS "CanaryToken_tokenHash_key" ON "CanaryToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "CanaryToken_projectId_active_idx" ON "CanaryToken"("projectId", "active");
CREATE INDEX IF NOT EXISTS "CanaryToken_projectId_scope_idx" ON "CanaryToken"("projectId", "scope");
CREATE INDEX IF NOT EXISTS "AgentReplay_projectId_createdAt_idx" ON "AgentReplay"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentReplay_sessionId_createdAt_idx" ON "AgentReplay"("sessionId", "createdAt");
