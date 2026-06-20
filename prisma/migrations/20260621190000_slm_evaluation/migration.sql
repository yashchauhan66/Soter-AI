CREATE TABLE "SlmEvaluation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "promptText" TEXT NOT NULL,
  "responseText" TEXT NOT NULL,
  "contextText" TEXT,
  "scoresJson" JSONB NOT NULL DEFAULT '[]',
  "overallScore" INTEGER NOT NULL DEFAULT 0,
  "overallPassed" BOOLEAN NOT NULL DEFAULT false,
  "modelUsed" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fk_slm_evaluation_project" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_slm_evaluation_project_created" ON "SlmEvaluation"("projectId", "createdAt" DESC);
CREATE INDEX "idx_slm_evaluation_overall_passed" ON "SlmEvaluation"("projectId", "overallPassed", "createdAt" DESC);
CREATE INDEX "idx_slm_evaluation_model_used" ON "SlmEvaluation"("projectId", "modelUsed", "createdAt" DESC);
