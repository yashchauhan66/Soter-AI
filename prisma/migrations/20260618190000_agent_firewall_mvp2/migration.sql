ALTER TABLE "AgentApproval"
ADD COLUMN IF NOT EXISTS "safeContent" TEXT;

CREATE TABLE IF NOT EXISTS "AgentManifest" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "agentName" TEXT NOT NULL,
  "manifestJson" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentManifest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentManifest_projectId_enabled_idx" ON "AgentManifest"("projectId", "enabled");
CREATE INDEX IF NOT EXISTS "AgentManifest_projectId_agentName_idx" ON "AgentManifest"("projectId", "agentName");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentManifest_projectId_agentName_key" ON "AgentManifest"("projectId", "agentName");
