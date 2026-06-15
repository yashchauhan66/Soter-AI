CREATE TABLE IF NOT EXISTS "AiProvider" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "providerType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REVIEW',
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "dataRegion" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiProvider_organizationId_name_key" ON "AiProvider"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "AiProvider_organizationId_status_idx" ON "AiProvider"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "AiModel" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT,
  "modality" TEXT NOT NULL DEFAULT 'TEXT',
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AiModel_organizationId_providerId_name_version_key" ON "AiModel"("organizationId", "providerId", "name", "version");
CREATE INDEX IF NOT EXISTS "AiModel_organizationId_approved_idx" ON "AiModel"("organizationId", "approved");

CREATE TABLE IF NOT EXISTS "PromptVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "promptHash" TEXT NOT NULL,
  "promptRedacted" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromptVersion_organizationId_projectId_name_version_key" ON "PromptVersion"("organizationId", "projectId", "name", "version");
CREATE INDEX IF NOT EXISTS "PromptVersion_organizationId_status_idx" ON "PromptVersion"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "PromptVersion_projectId_idx" ON "PromptVersion"("projectId");

CREATE TABLE IF NOT EXISTS "ToolIntegration" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolIntegration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ToolIntegration_organizationId_projectId_name_key" ON "ToolIntegration"("organizationId", "projectId", "name");
CREATE INDEX IF NOT EXISTS "ToolIntegration_organizationId_enabled_idx" ON "ToolIntegration"("organizationId", "enabled");
CREATE INDEX IF NOT EXISTS "ToolIntegration_projectId_idx" ON "ToolIntegration"("projectId");

CREATE TABLE IF NOT EXISTS "PluginInventory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "version" TEXT,
  "source" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REVIEW',
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PluginInventory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PluginInventory_organizationId_status_idx" ON "PluginInventory"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "PluginInventory_projectId_idx" ON "PluginInventory"("projectId");

CREATE TABLE IF NOT EXISTS "AiBillOfMaterials" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "snapshot" JSONB NOT NULL,
  "riskSummary" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiBillOfMaterials_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiBillOfMaterials_organizationId_createdAt_idx" ON "AiBillOfMaterials"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiBillOfMaterials_projectId_createdAt_idx" ON "AiBillOfMaterials"("projectId", "createdAt");

CREATE TABLE IF NOT EXISTS "SupplyChainRiskFinding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "SupplyChainRiskFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupplyChainRiskFinding_organizationId_status_severity_idx" ON "SupplyChainRiskFinding"("organizationId", "status", "severity");
CREATE INDEX IF NOT EXISTS "SupplyChainRiskFinding_projectId_idx" ON "SupplyChainRiskFinding"("projectId");

CREATE TABLE IF NOT EXISTS "AgentTool" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentTool_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentTool_organizationId_projectId_name_key" ON "AgentTool"("organizationId", "projectId", "name");
CREATE INDEX IF NOT EXISTS "AgentTool_organizationId_enabled_idx" ON "AgentTool"("organizationId", "enabled");
CREATE INDEX IF NOT EXISTS "AgentTool_projectId_idx" ON "AgentTool"("projectId");

CREATE TABLE IF NOT EXISTS "ToolPermission" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "toolId" TEXT NOT NULL,
  "role" TEXT,
  "allow" BOOLEAN NOT NULL DEFAULT false,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "maxCallsPerMinute" INTEGER,
  "costBudgetPaise" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ToolPermission_organizationId_projectId_toolId_role_key" ON "ToolPermission"("organizationId", "projectId", "toolId", "role");
CREATE INDEX IF NOT EXISTS "ToolPermission_organizationId_projectId_idx" ON "ToolPermission"("organizationId", "projectId");

CREATE TABLE IF NOT EXISTS "ToolCallLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "toolId" TEXT,
  "toolName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "decision" TEXT NOT NULL,
  "redactedInput" JSONB,
  "redactedOutput" JSONB,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolCallLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ToolCallLog_organizationId_projectId_createdAt_idx" ON "ToolCallLog"("organizationId", "projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "ToolCallLog_decision_createdAt_idx" ON "ToolCallLog"("decision", "createdAt");

CREATE TABLE IF NOT EXISTS "ToolApprovalRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "toolCallLogId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "reviewedById" TEXT,
  "reason" TEXT NOT NULL,
  "preview" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "ToolApprovalRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ToolApprovalRequest_organizationId_status_createdAt_idx" ON "ToolApprovalRequest"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ToolApprovalRequest_projectId_status_idx" ON "ToolApprovalRequest"("projectId", "status");

CREATE TABLE IF NOT EXISTS "ToolRiskPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "defaultAction" TEXT NOT NULL DEFAULT 'DENY',
  "approvalThreshold" INTEGER NOT NULL DEFAULT 70,
  "blockThreshold" INTEGER NOT NULL DEFAULT 90,
  "highRiskContextReview" BOOLEAN NOT NULL DEFAULT true,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolRiskPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ToolRiskPolicy_organizationId_projectId_key" ON "ToolRiskPolicy"("organizationId", "projectId");

CREATE TABLE IF NOT EXISTS "ToolRollbackLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "toolCallLogId" TEXT,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "redactedDetails" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolRollbackLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ToolRollbackLog_organizationId_projectId_createdAt_idx" ON "ToolRollbackLog"("organizationId", "projectId", "createdAt");

CREATE TABLE IF NOT EXISTS "ThreatIntelSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'INTERNAL',
  "trustLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreatIntelSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ThreatIntelSource_name_key" ON "ThreatIntelSource"("name");
CREATE INDEX IF NOT EXISTS "ThreatIntelSource_enabled_idx" ON "ThreatIntelSource"("enabled");

CREATE TABLE IF NOT EXISTS "ThreatPattern" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "pattern" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "safeTestText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreatPattern_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ThreatPattern_category_status_idx" ON "ThreatPattern"("category", "status");
CREATE INDEX IF NOT EXISTS "ThreatPattern_sourceId_idx" ON "ThreatPattern"("sourceId");

CREATE TABLE IF NOT EXISTS "DetectorRuleVersion" (
  "id" TEXT NOT NULL,
  "detector" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'SHADOW',
  "patterns" JSONB NOT NULL,
  "approvedById" TEXT,
  "activatedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DetectorRuleVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DetectorRuleVersion_detector_version_key" ON "DetectorRuleVersion"("detector", "version");
CREATE INDEX IF NOT EXISTS "DetectorRuleVersion_detector_mode_idx" ON "DetectorRuleVersion"("detector", "mode");

CREATE TABLE IF NOT EXISTS "ThreatUpdateJob" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "report" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ThreatUpdateJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ThreatUpdateJob_status_createdAt_idx" ON "ThreatUpdateJob"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "ThreatIntelAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreatIntelAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ThreatIntelAuditLog_action_createdAt_idx" ON "ThreatIntelAuditLog"("action", "createdAt");

CREATE TABLE IF NOT EXISTS "BenchmarkDataset" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "publicSafe" BOOLEAN NOT NULL DEFAULT false,
  "limitations" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BenchmarkDataset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BenchmarkDataset_organizationId_name_version_key" ON "BenchmarkDataset"("organizationId", "name", "version");
CREATE INDEX IF NOT EXISTS "BenchmarkDataset_category_publicSafe_idx" ON "BenchmarkDataset"("category", "publicSafe");

CREATE TABLE IF NOT EXISTS "BenchmarkExample" (
  "id" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "redactedText" TEXT NOT NULL,
  "expectedLabel" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BenchmarkExample_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BenchmarkExample_datasetId_category_idx" ON "BenchmarkExample"("datasetId", "category");
CREATE INDEX IF NOT EXISTS "BenchmarkExample_language_idx" ON "BenchmarkExample"("language");

CREATE TABLE IF NOT EXISTS "BenchmarkRun" (
  "id" TEXT NOT NULL,
  "datasetId" TEXT NOT NULL,
  "detectorVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "metrics" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "BenchmarkRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BenchmarkRun_datasetId_startedAt_idx" ON "BenchmarkRun"("datasetId", "startedAt");
CREATE INDEX IF NOT EXISTS "BenchmarkRun_status_idx" ON "BenchmarkRun"("status");

CREATE TABLE IF NOT EXISTS "BenchmarkResult" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "exampleId" TEXT NOT NULL,
  "expectedLabel" TEXT NOT NULL,
  "predictedLabel" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BenchmarkResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BenchmarkResult_runId_correct_idx" ON "BenchmarkResult"("runId", "correct");
CREATE INDEX IF NOT EXISTS "BenchmarkResult_exampleId_idx" ON "BenchmarkResult"("exampleId");

CREATE TABLE IF NOT EXISTS "DetectorAccuracySnapshot" (
  "id" TEXT NOT NULL,
  "detectorVersion" TEXT NOT NULL,
  "datasetVersion" TEXT NOT NULL,
  "metrics" JSONB NOT NULL,
  "limitations" TEXT,
  "publicSafe" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DetectorAccuracySnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DetectorAccuracySnapshot_detectorVersion_createdAt_idx" ON "DetectorAccuracySnapshot"("detectorVersion", "createdAt");
CREATE INDEX IF NOT EXISTS "DetectorAccuracySnapshot_publicSafe_idx" ON "DetectorAccuracySnapshot"("publicSafe");

CREATE TABLE IF NOT EXISTS "DataSubjectRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterEmail" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "confirmation" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DataSubjectRequest_organizationId_status_createdAt_idx" ON "DataSubjectRequest"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "DataSubjectRequest_requesterEmail_idx" ON "DataSubjectRequest"("requesterEmail");

CREATE TABLE IF NOT EXISTS "ConsentRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subjectEmail" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "evidenceHash" TEXT,
  "metadata" JSONB,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ConsentRecord_organizationId_subjectEmail_idx" ON "ConsentRecord"("organizationId", "subjectEmail");
CREATE INDEX IF NOT EXISTS "ConsentRecord_purpose_status_idx" ON "ConsentRecord"("purpose", "status");

CREATE TABLE IF NOT EXISTS "PrivacyIncident" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INVESTIGATING',
  "redactedSummary" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "PrivacyIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PrivacyIncident_organizationId_status_createdAt_idx" ON "PrivacyIncident"("organizationId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "BreachNotificationDraft" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL DEFAULT 'IN-DPDP',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "redactedContent" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BreachNotificationDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BreachNotificationDraft_organizationId_status_createdAt_idx" ON "BreachNotificationDraft"("organizationId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "DataProcessingRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "systemName" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "dataCategories" TEXT[],
  "retention" TEXT,
  "subprocessors" TEXT[],
  "safeguards" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataProcessingRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DataProcessingRecord_organizationId_systemName_idx" ON "DataProcessingRecord"("organizationId", "systemName");

CREATE TABLE IF NOT EXISTS "AbuseSignal" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "projectId" TEXT,
  "signalType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AbuseSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AbuseSignal_organizationId_status_createdAt_idx" ON "AbuseSignal"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AbuseSignal_projectId_createdAt_idx" ON "AbuseSignal"("projectId", "createdAt");

CREATE TABLE IF NOT EXISTS "UsageAnomaly" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "projectId" TEXT,
  "metric" TEXT NOT NULL,
  "baseline" DOUBLE PRECISION NOT NULL,
  "observed" DOUBLE PRECISION NOT NULL,
  "severity" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageAnomaly_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UsageAnomaly_organizationId_createdAt_idx" ON "UsageAnomaly"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageAnomaly_projectId_metric_idx" ON "UsageAnomaly"("projectId", "metric");

CREATE TABLE IF NOT EXISTS "CostBudget" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "monthlyLimitPaise" INTEGER NOT NULL,
  "usedPaise" INTEGER NOT NULL DEFAULT 0,
  "hardStop" BOOLEAN NOT NULL DEFAULT true,
  "alertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostBudget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CostBudget_organizationId_projectId_key" ON "CostBudget"("organizationId", "projectId");

CREATE TABLE IF NOT EXISTS "ThrottleEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "projectId" TEXT,
  "reason" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'AUTO_THROTTLE',
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThrottleEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ThrottleEvent_organizationId_createdAt_idx" ON "ThrottleEvent"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ThrottleEvent_projectId_expiresAt_idx" ON "ThrottleEvent"("projectId", "expiresAt");
