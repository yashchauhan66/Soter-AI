-- Advanced AI Security MVP 1: Context Lineage Firewall + Agent Blast Radius Simulator

CREATE TABLE IF NOT EXISTS "ContextSource" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceName" TEXT,
  "sourceTrustLevel" TEXT NOT NULL,
  "sensitivityLevel" TEXT NOT NULL,
  "metadataJson" JSONB,
  "contentHash" TEXT NOT NULL,
  "contentRedacted" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContextSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContextFlow" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT,
  "sourceId" TEXT,
  "destinationType" TEXT NOT NULL,
  "destinationName" TEXT,
  "destinationTrustLevel" TEXT NOT NULL,
  "action" TEXT,
  "decision" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "redactionsJson" JSONB,
  "policyMatchesJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContextFlow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LineageIncident" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT,
  "incidentType" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "involvedSourcesJson" JSONB,
  "involvedDestinationsJson" JSONB,
  "recommendedFix" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LineageIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentRiskProfile" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "agentName" TEXT NOT NULL,
  "agentType" TEXT,
  "toolsJson" JSONB,
  "permissionsJson" JSONB,
  "dataSourcesJson" JSONB,
  "externalDestinationsJson" JSONB,
  "memoryAccessJson" JSONB,
  "policyJson" JSONB,
  "blastRadiusScore" INTEGER NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "findingsJson" JSONB,
  "recommendationsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentRiskProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BlastRadiusSimulation" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "agentRiskProfileId" TEXT,
  "scenarioName" TEXT NOT NULL,
  "scenarioJson" JSONB,
  "resultJson" JSONB NOT NULL,
  "blastRadiusScore" INTEGER NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlastRadiusSimulation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContextSource_projectId_createdAt_idx" ON "ContextSource"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContextSource_projectId_sessionId_idx" ON "ContextSource"("projectId", "sessionId");
CREATE INDEX IF NOT EXISTS "ContextFlow_projectId_createdAt_idx" ON "ContextFlow"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ContextFlow_projectId_sessionId_idx" ON "ContextFlow"("projectId", "sessionId");
CREATE INDEX IF NOT EXISTS "ContextFlow_projectId_decision_idx" ON "ContextFlow"("projectId", "decision");
CREATE INDEX IF NOT EXISTS "LineageIncident_projectId_status_createdAt_idx" ON "LineageIncident"("projectId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "LineageIncident_projectId_riskLevel_idx" ON "LineageIncident"("projectId", "riskLevel");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentRiskProfile_projectId_agentName_key" ON "AgentRiskProfile"("projectId", "agentName");
CREATE INDEX IF NOT EXISTS "AgentRiskProfile_projectId_riskLevel_idx" ON "AgentRiskProfile"("projectId", "riskLevel");
CREATE INDEX IF NOT EXISTS "BlastRadiusSimulation_projectId_createdAt_idx" ON "BlastRadiusSimulation"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "BlastRadiusSimulation_agentRiskProfileId_idx" ON "BlastRadiusSimulation"("agentRiskProfileId");
