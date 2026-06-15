-- CreateEnum
CREATE TYPE "CustomerOnboardingType" AS ENUM ('BETA', 'AGENCY', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OnboardingStepState" AS ENUM ('COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PartnerTier" AS ENUM ('STARTER_PARTNER', 'VERIFIED_PARTNER', 'PREMIUM_PARTNER');

-- CreateEnum
CREATE TYPE "EnterprisePilotStatus" AS ENUM ('REQUESTED', 'QUALIFYING', 'INTEGRATING', 'VALIDATING', 'COMPLETED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('INTEGRATION_HELP', 'BILLING', 'FALSE_POSITIVE', 'MISSED_DETECTION', 'RAG_ISSUE', 'WEBHOOK_ISSUE', 'ENTERPRISE_SETUP', 'SECURITY_CONCERN');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentImpact" AS ENUM ('NONE', 'MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FeedbackReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'NEEDS_MORE_INFO');

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'GRACE_PERIOD';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "gracePeriodEndsAt" TIMESTAMP(3),
ADD COLUMN     "paymentFailedAt" TIMESTAMP(3),
ADD COLUMN     "reactivatedAt" TIMESTAMP(3),
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CustomerOnboarding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "CustomerOnboardingType" NOT NULL DEFAULT 'BETA',
    "chatbotType" TEXT,
    "integrationMethod" TEXT,
    "outputGuardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "firstGuardRequestAt" TIMESTAMP(3),
    "firstBlockedEventAt" TIMESTAMP(3),
    "firstReportAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStepEvent" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "state" "OnboardingStepState" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingStepEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tier" "PartnerTier" NOT NULL DEFAULT 'STARTER_PARTNER',
    "referralCode" TEXT NOT NULL,
    "website" TEXT,
    "focusMarkets" TEXT[],
    "commissionTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "commissionPendingPaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterprisePilot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "requestedById" TEXT,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "chatbotType" TEXT NOT NULL,
    "usesRag" BOOLEAN NOT NULL DEFAULT false,
    "expectedMonthlyMessages" INTEGER NOT NULL,
    "securityRequirements" TEXT NOT NULL,
    "needsSso" BOOLEAN NOT NULL DEFAULT false,
    "needsScim" BOOLEAN NOT NULL DEFAULT false,
    "deploymentPreference" TEXT NOT NULL,
    "status" "EnterprisePilotStatus" NOT NULL DEFAULT 'REQUESTED',
    "successCriteria" JSONB,
    "checklist" JSONB,
    "deliverables" JSONB,
    "targetStartAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterprisePilot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "category" "SupportTicketCategory" NOT NULL,
    "priority" "SupportPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "redactedContext" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdById" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'INVESTIGATING',
    "impact" "IncidentImpact" NOT NULL DEFAULT 'MINOR',
    "affectedComponents" TEXT[],
    "public" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentUpdate" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT,
    "status" "IncidentStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackReview" (
    "id" TEXT NOT NULL,
    "detectionFeedbackId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "FeedbackReviewStatus" NOT NULL DEFAULT 'PENDING',
    "redactedExample" TEXT,
    "datasetVersion" TEXT,
    "detector" TEXT,
    "thresholdSuggestion" DOUBLE PRECISION,
    "tuningSuggestion" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "projectId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "properties" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMetric" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "dimensions" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT,
    "monthlyMessages" INTEGER,
    "interest" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "deploymentPreference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerOnboarding_userId_createdAt_idx" ON "CustomerOnboarding"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerOnboarding_completedAt_updatedAt_idx" ON "CustomerOnboarding"("completedAt", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOnboarding_organizationId_type_key" ON "CustomerOnboarding"("organizationId", "type");

-- CreateIndex
CREATE INDEX "OnboardingStepEvent_stepKey_state_occurredAt_idx" ON "OnboardingStepEvent"("stepKey", "state", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStepEvent_onboardingId_stepKey_key" ON "OnboardingStepEvent"("onboardingId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_organizationId_key" ON "PartnerProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_referralCode_key" ON "PartnerProfile"("referralCode");

-- CreateIndex
CREATE INDEX "PartnerProfile_tier_idx" ON "PartnerProfile"("tier");

-- CreateIndex
CREATE INDEX "EnterprisePilot_organizationId_status_idx" ON "EnterprisePilot"("organizationId", "status");

-- CreateIndex
CREATE INDEX "EnterprisePilot_contactEmail_createdAt_idx" ON "EnterprisePilot"("contactEmail", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_status_updatedAt_idx" ON "SupportTicket"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_status_idx" ON "SupportTicket"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_slug_key" ON "Incident"("slug");

-- CreateIndex
CREATE INDEX "Incident_public_status_startedAt_idx" ON "Incident"("public", "status", "startedAt");

-- CreateIndex
CREATE INDEX "Incident_organizationId_createdAt_idx" ON "Incident"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentUpdate_incidentId_createdAt_idx" ON "IncidentUpdate"("incidentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackReview_detectionFeedbackId_key" ON "FeedbackReview"("detectionFeedbackId");

-- CreateIndex
CREATE INDEX "FeedbackReview_status_createdAt_idx" ON "FeedbackReview"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReview_detector_status_idx" ON "FeedbackReview"("detector", "status");

-- CreateIndex
CREATE INDEX "ProductEvent_organizationId_eventType_occurredAt_idx" ON "ProductEvent"("organizationId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "ProductEvent_userId_occurredAt_idx" ON "ProductEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProductionMetric_metric_recordedAt_idx" ON "ProductionMetric"("metric", "recordedAt");

-- CreateIndex
CREATE INDEX "ProductionMetric_organizationId_metric_recordedAt_idx" ON "ProductionMetric"("organizationId", "metric", "recordedAt");

-- CreateIndex
CREATE INDEX "ContactLead_status_createdAt_idx" ON "ContactLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactLead_email_createdAt_idx" ON "ContactLead"("email", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerOnboarding" ADD CONSTRAINT "CustomerOnboarding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOnboarding" ADD CONSTRAINT "CustomerOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOnboarding" ADD CONSTRAINT "CustomerOnboarding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStepEvent" ADD CONSTRAINT "OnboardingStepEvent_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "CustomerOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterprisePilot" ADD CONSTRAINT "EnterprisePilot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterprisePilot" ADD CONSTRAINT "EnterprisePilot_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReview" ADD CONSTRAINT "FeedbackReview_detectionFeedbackId_fkey" FOREIGN KEY ("detectionFeedbackId") REFERENCES "DetectionFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReview" ADD CONSTRAINT "FeedbackReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMetric" ADD CONSTRAINT "ProductionMetric_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

