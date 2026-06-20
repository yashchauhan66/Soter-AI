CREATE TABLE IF NOT EXISTS "CanaryLeakEvent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "canaryTokenId" TEXT,
  "sessionId" TEXT,
  "location" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "contentRedacted" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanaryLeakEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CanaryLeakEvent_projectId_createdAt_idx" ON "CanaryLeakEvent"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "CanaryLeakEvent_projectId_riskLevel_createdAt_idx" ON "CanaryLeakEvent"("projectId", "riskLevel", "createdAt");
CREATE INDEX IF NOT EXISTS "CanaryLeakEvent_canaryTokenId_createdAt_idx" ON "CanaryLeakEvent"("canaryTokenId", "createdAt");
CREATE INDEX IF NOT EXISTS "CanaryLeakEvent_sessionId_createdAt_idx" ON "CanaryLeakEvent"("sessionId", "createdAt");
