-- Phase 3: real auth, organizations, RBAC, billing, policy, durable webhook queue, audit exports.

-- Enums
CREATE TYPE "OrganizationType" AS ENUM ('DIRECT_BUSINESS', 'AGENCY', 'INTERNAL_ADMIN');
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'DEVELOPER', 'SECURITY_ANALYST', 'BILLING', 'VIEWER');
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
CREATE TYPE "PolicyMode" AS ENUM ('MONITOR', 'BALANCED', 'STRICT');
CREATE TYPE "UnsafeOutputMode" AS ENUM ('WARN', 'REDACT', 'BLOCK');
CREATE TYPE "AuditExportFormat" AS ENUM ('JSONL', 'CSV', 'PDF');
CREATE TYPE "AuditExportKind" AS ENUM ('GUARD_LOGS', 'WEBHOOK_DELIVERIES', 'API_KEY_AUDIT', 'POLICY_CHANGES');
CREATE TYPE "AuditExportStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED');

-- WebhookDeliveryStatus already exists; add new values
ALTER TYPE "WebhookDeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "WebhookDeliveryStatus" ADD VALUE IF NOT EXISTS 'RETRYING';
ALTER TYPE "WebhookDeliveryStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- User: passwordHash, emailVerifiedAt, isAdmin
ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Organization
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'DIRECT_BUSINESS',
    "plan" "ProjectPlan" NOT NULL DEFAULT 'FREE',
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- OrganizationMember
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- Invite
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'DEVELOPER',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");
CREATE INDEX "Invite_organizationId_idx" ON "Invite"("organizationId");
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- Agency: organizationId
ALTER TABLE "Agency" ADD COLUMN "organizationId" TEXT;
CREATE UNIQUE INDEX "Agency_organizationId_key" ON "Agency"("organizationId");

-- Project: organizationId
ALTER TABLE "Project" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- ProjectPolicy
CREATE TABLE "ProjectPolicy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mode" "PolicyMode" NOT NULL DEFAULT 'BALANCED',
    "blockPromptInjection" BOOLEAN NOT NULL DEFAULT true,
    "blockJailbreak" BOOLEAN NOT NULL DEFAULT true,
    "redactPII" BOOLEAN NOT NULL DEFAULT true,
    "redactIndiaPII" BOOLEAN NOT NULL DEFAULT true,
    "blockSecrets" BOOLEAN NOT NULL DEFAULT true,
    "blockSystemPromptLeak" BOOLEAN NOT NULL DEFAULT true,
    "unsafeOutputMode" "UnsafeOutputMode" NOT NULL DEFAULT 'BLOCK',
    "customBlockedTopics" TEXT[],
    "allowlistedDomains" TEXT[],
    "deniedPatterns" TEXT[],
    "customFallbackMessage" TEXT,
    "riskThresholds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectPolicy_projectId_key" ON "ProjectPolicy"("projectId");

-- Report: pdfPath
ALTER TABLE "Report" ADD COLUMN "pdfPath" TEXT;

-- WebhookDelivery: idempotencyKey, nextAttemptAt, deliveredAt, payloadPreview
ALTER TABLE "WebhookDelivery"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "payloadPreview" JSONB;
UPDATE "WebhookDelivery" SET "idempotencyKey" = 'idem_' || replace(gen_random_uuid()::text, '-', '') WHERE "idempotencyKey" IS NULL;
ALTER TABLE "WebhookDelivery" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "WebhookDelivery_idempotencyKey_key" ON "WebhookDelivery"("idempotencyKey");
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- Subscription
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" "ProjectPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "razorpayCustomerId" TEXT,
    "razorpaySubscriptionId" TEXT,
    "razorpayPlanId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");
CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- Invoice
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "razorpayInvoiceId" TEXT,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "hostedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Invoice_organizationId_createdAt_idx" ON "Invoice"("organizationId", "createdAt");

-- PaymentEvent
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentEvent_eventId_key" ON "PaymentEvent"("eventId");
CREATE INDEX "PaymentEvent_organizationId_receivedAt_idx" ON "PaymentEvent"("organizationId", "receivedAt");
CREATE INDEX "PaymentEvent_eventType_idx" ON "PaymentEvent"("eventType");

-- PlanChangeLog
CREATE TABLE "PlanChangeLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromPlan" "ProjectPlan",
    "toPlan" "ProjectPlan" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanChangeLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlanChangeLog_organizationId_createdAt_idx" ON "PlanChangeLog"("organizationId", "createdAt");

-- AuditExport
CREATE TABLE "AuditExport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedById" TEXT,
    "kind" "AuditExportKind" NOT NULL,
    "format" "AuditExportFormat" NOT NULL,
    "filterFromDate" TIMESTAMP(3),
    "filterToDate" TIMESTAMP(3),
    "filterProjectId" TEXT,
    "status" "AuditExportStatus" NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "storagePath" TEXT,
    "signature" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditExport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditExport_organizationId_createdAt_idx" ON "AuditExport"("organizationId", "createdAt");

-- Foreign keys
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPolicy" ADD CONSTRAINT "ProjectPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanChangeLog" ADD CONSTRAINT "PlanChangeLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditExport" ADD CONSTRAINT "AuditExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditExport" ADD CONSTRAINT "AuditExport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: create a default organization for every existing user, link projects + agency
DO $$
DECLARE
  u RECORD;
  new_org_id TEXT;
BEGIN
  FOR u IN SELECT "id", "email", "name" FROM "User" LOOP
    new_org_id := 'org_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO "Organization" ("id", "name", "slug", "type", "plan", "createdAt", "updatedAt")
      VALUES (new_org_id, COALESCE(u."name", split_part(u."email", '@', 1)) || ' workspace',
              'org-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12),
              'DIRECT_BUSINESS', 'FREE', now(), now());
    INSERT INTO "OrganizationMember" ("id", "organizationId", "userId", "role", "createdAt", "updatedAt")
      VALUES ('mem_' || replace(gen_random_uuid()::text, '-', ''), new_org_id, u."id", 'OWNER', now(), now());
    UPDATE "Project" SET "organizationId" = new_org_id WHERE "userId" = u."id" AND "organizationId" IS NULL;
    UPDATE "Agency" SET "organizationId" = new_org_id WHERE "userId" = u."id" AND "organizationId" IS NULL;
  END LOOP;
END $$;
