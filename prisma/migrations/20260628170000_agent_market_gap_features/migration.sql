-- Agent Permission Diff + Deployment Gate
CREATE TABLE "AgentPermissionDeploymentGate" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "deploymentId" TEXT,
  "agentName" TEXT NOT NULL,
  "baselineHash" TEXT NOT NULL,
  "candidateHash" TEXT NOT NULL,
  "riskBefore" INTEGER NOT NULL,
  "riskAfter" INTEGER NOT NULL,
  "riskDelta" INTEGER NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "findingsJson" JSONB NOT NULL,
  "policyJson" JSONB,
  "summary" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentPermissionDeploymentGate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentPermissionDeploymentGate_projectId_createdAt_idx" ON "AgentPermissionDeploymentGate"("projectId", "createdAt");
CREATE INDEX "AgentPermissionDeploymentGate_projectId_decision_createdAt_idx" ON "AgentPermissionDeploymentGate"("projectId", "decision", "createdAt");
CREATE INDEX "AgentPermissionDeploymentGate_projectId_deploymentId_idx" ON "AgentPermissionDeploymentGate"("projectId", "deploymentId");

-- Agent Action Reversal / Undo Ledger
CREATE TABLE "AgentActionLedger" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT,
  "agentIdentityId" TEXT,
  "passportId" TEXT,
  "tool" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetRedacted" TEXT,
  "actionHash" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reversalStatus" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "forwardActionJson" JSONB,
  "rollbackActionJson" JSONB,
  "requestHash" TEXT NOT NULL,
  "resultHash" TEXT NOT NULL,
  "rollbackDeadline" TIMESTAMP(3),
  "rollbackStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  "rollbackAttemptedAt" TIMESTAMP(3),
  "irreversibleReason" TEXT,
  "summary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentActionLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentActionLedger_projectId_idempotencyKey_key" ON "AgentActionLedger"("projectId", "idempotencyKey");
CREATE INDEX "AgentActionLedger_projectId_createdAt_idx" ON "AgentActionLedger"("projectId", "createdAt");
CREATE INDEX "AgentActionLedger_projectId_sessionId_createdAt_idx" ON "AgentActionLedger"("projectId", "sessionId", "createdAt");
CREATE INDEX "AgentActionLedger_projectId_rollbackStatus_idx" ON "AgentActionLedger"("projectId", "rollbackStatus");
CREATE INDEX "AgentActionLedger_projectId_decision_riskLevel_idx" ON "AgentActionLedger"("projectId", "decision", "riskLevel");

-- MCP Risk Scanner + Public Badge
CREATE TABLE "McpRiskScan" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "serverName" TEXT NOT NULL,
  "serverUrl" TEXT,
  "repositoryUrl" TEXT,
  "scanHash" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "findingsJson" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "publicBadge" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "McpRiskScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "McpRiskScan_projectId_createdAt_idx" ON "McpRiskScan"("projectId", "createdAt");
CREATE INDEX "McpRiskScan_scanHash_idx" ON "McpRiskScan"("scanHash");
CREATE INDEX "McpRiskScan_riskLevel_createdAt_idx" ON "McpRiskScan"("riskLevel", "createdAt");
