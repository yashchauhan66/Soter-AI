-- Configurable handling for a lone, sub-threshold prompt-injection signal.
-- Defaults to REWRITE so existing projects keep their current behaviour.
ALTER TABLE "ProjectPolicy" ADD COLUMN "bareInjectionHandling" TEXT NOT NULL DEFAULT 'REWRITE';
