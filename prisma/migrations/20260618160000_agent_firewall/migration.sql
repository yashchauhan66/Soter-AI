CREATE TABLE "AgentSession" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT,
  "apiKeyId" TEXT,
  "agentName" TEXT NOT NULL,
  "agentType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentActionLog" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "projectId" TEXT NOT NULL,
  "userId" TEXT,
  "tool" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "destination" TEXT NOT NULL DEFAULT 'unknown',
  "decision" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "originalContentRedacted" TEXT,
  "safeContent" TEXT,
  "policyMatchesJson" JSONB,
  "redactionsJson" JSONB,
  "approvalId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentActionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentApproval" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "projectId" TEXT NOT NULL,
  "actionLogId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvalTokenHash" TEXT NOT NULL,
  "requestedAction" JSONB NOT NULL,
  "requestedContentRedacted" TEXT,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentPolicy" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Default Agent Firewall Policy',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "rulesJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentSession_projectId_status_createdAt_idx" ON "AgentSession"("projectId", "status", "createdAt");
CREATE INDEX "AgentSession_apiKeyId_idx" ON "AgentSession"("apiKeyId");
CREATE INDEX "AgentSession_agentName_idx" ON "AgentSession"("agentName");

CREATE INDEX "AgentActionLog_sessionId_createdAt_idx" ON "AgentActionLog"("sessionId", "createdAt");
CREATE INDEX "AgentActionLog_projectId_createdAt_idx" ON "AgentActionLog"("projectId", "createdAt");
CREATE INDEX "AgentActionLog_projectId_decision_createdAt_idx" ON "AgentActionLog"("projectId", "decision", "createdAt");
CREATE INDEX "AgentActionLog_riskLevel_createdAt_idx" ON "AgentActionLog"("riskLevel", "createdAt");

CREATE UNIQUE INDEX "AgentApproval_approvalTokenHash_key" ON "AgentApproval"("approvalTokenHash");
CREATE INDEX "AgentApproval_projectId_status_createdAt_idx" ON "AgentApproval"("projectId", "status", "createdAt");
CREATE INDEX "AgentApproval_sessionId_status_idx" ON "AgentApproval"("sessionId", "status");
CREATE INDEX "AgentApproval_actionLogId_idx" ON "AgentApproval"("actionLogId");

CREATE INDEX "AgentPolicy_projectId_enabled_idx" ON "AgentPolicy"("projectId", "enabled");
CREATE UNIQUE INDEX "AgentPolicy_projectId_name_key" ON "AgentPolicy"("projectId", "name");
