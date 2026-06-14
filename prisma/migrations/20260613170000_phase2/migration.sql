-- Phase 2: agencies, clients, webhooks, branding, onboarding, badge fields, ENTERPRISE plan

-- Update ProjectPlan enum: add ENTERPRISE
ALTER TYPE "ProjectPlan" ADD VALUE IF NOT EXISTS 'ENTERPRISE';

-- CreateEnum
CREATE TYPE "BadgeStatus" AS ENUM ('PROTECTED', 'MONITORING_ACTIVE', 'ISSUES_FOUND', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable Project: add publicName, clientId, badgeSlug, badgeEnabled
ALTER TABLE "Project"
  ADD COLUMN "publicName" TEXT,
  ADD COLUMN "clientId" TEXT,
  ADD COLUMN "badgeSlug" TEXT,
  ADD COLUMN "badgeEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Backfill badge slugs for existing rows
UPDATE "Project" SET "badgeSlug" = 'badge_' || replace(gen_random_uuid()::text, '-', '') WHERE "badgeSlug" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "badgeSlug" SET NOT NULL;
CREATE UNIQUE INDEX "Project_badgeSlug_key" ON "Project"("badgeSlug");
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");
CREATE INDEX "Project_badgeSlug_idx" ON "Project"("badgeSlug");

-- CreateTable Agency
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Agency_userId_key" ON "Agency"("userId");

-- CreateTable Client
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Client_agencyId_idx" ON "Client"("agencyId");

-- CreateTable BrandingSettings
CREATE TABLE "BrandingSettings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "contactEmail" TEXT,
    "reportFooter" TEXT,
    "brandColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrandingSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BrandingSettings_agencyId_key" ON "BrandingSettings"("agencyId");

-- CreateTable WebhookEndpoint
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "secretHash" TEXT NOT NULL,
    "secretPreview" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebhookEndpoint_projectId_idx" ON "WebhookEndpoint"("projectId");

-- CreateTable WebhookDelivery
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");

-- CreateTable OnboardingProgress
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectCreated" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyGenerated" BOOLEAN NOT NULL DEFAULT false,
    "firstGuardRequest" BOOLEAN NOT NULL DEFAULT false,
    "webhookConfigured" BOOLEAN NOT NULL DEFAULT false,
    "badgeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reportGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sdkInstalled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OnboardingProgress_userId_key" ON "OnboardingProgress"("userId");

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandingSettings" ADD CONSTRAINT "BrandingSettings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
