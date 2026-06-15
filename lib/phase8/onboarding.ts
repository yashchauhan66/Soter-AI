import type { CustomerOnboardingType, GuardAction, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sanitizeMetadata } from "@/lib/guard/logSafety";

export const ONBOARDING_STEPS = [
  "organization_created",
  "project_created",
  "api_key_generated",
  "chatbot_type_selected",
  "integration_selected",
  "first_guarded_request",
  "output_guard_enabled",
  "policy_configured",
  "badge_enabled",
  "alert_configured",
  "first_report_generated",
  "teammate_invited",
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_STEP_CONTENT: Record<OnboardingStepKey, { title: string; href: string }> = {
  organization_created: { title: "Create organization", href: "/dashboard/settings" },
  project_created: { title: "Create project", href: "/dashboard/projects/new" },
  api_key_generated: { title: "Generate API key", href: "/dashboard/api-keys" },
  chatbot_type_selected: { title: "Select chatbot type", href: "/dashboard/get-started" },
  integration_selected: { title: "Install SDK or select REST", href: "/docs#sdk" },
  first_guarded_request: { title: "Send first guarded request", href: "/playground" },
  output_guard_enabled: { title: "Enable output guard", href: "/docs" },
  policy_configured: { title: "Configure policy", href: "/dashboard/policy" },
  badge_enabled: { title: "Enable security badge", href: "/dashboard/badges" },
  alert_configured: { title: "Configure webhook or Slack alert", href: "/dashboard/webhooks" },
  first_report_generated: { title: "Generate first report", href: "/dashboard/reports" },
  teammate_invited: { title: "Invite teammate", href: "/dashboard/settings" },
};

export async function ensureCustomerOnboarding(input: {
  organizationId: string;
  userId: string;
  projectId?: string | null;
  type?: CustomerOnboardingType;
}) {
  return db.customerOnboarding.upsert({
    where: { organizationId_type: { organizationId: input.organizationId, type: input.type ?? "BETA" } },
    create: {
      organizationId: input.organizationId,
      userId: input.userId,
      projectId: input.projectId,
      type: input.type ?? "BETA",
    },
    update: { projectId: input.projectId ?? undefined },
    include: { stepEvents: { orderBy: { occurredAt: "asc" } } },
  });
}

export async function recordOnboardingStep(input: {
  onboardingId: string;
  stepKey: OnboardingStepKey;
  state: "COMPLETED" | "SKIPPED";
  metadata?: Record<string, unknown>;
}) {
  const event = await db.onboardingStepEvent.upsert({
    where: { onboardingId_stepKey: { onboardingId: input.onboardingId, stepKey: input.stepKey } },
    create: {
      onboardingId: input.onboardingId,
      stepKey: input.stepKey,
      state: input.state,
      metadata: sanitizeMetadata(input.metadata) as Prisma.InputJsonValue,
    },
    update: {
      state: input.state,
      occurredAt: new Date(),
      metadata: sanitizeMetadata(input.metadata) as Prisma.InputJsonValue,
    },
  });
  const count = await db.onboardingStepEvent.count({ where: { onboardingId: input.onboardingId } });
  await db.customerOnboarding.update({
    where: { id: input.onboardingId },
    data: {
      chatbotType: input.stepKey === "chatbot_type_selected" ? String(input.metadata?.chatbotType ?? "other") : undefined,
      integrationMethod: input.stepKey === "integration_selected" ? String(input.metadata?.integrationMethod ?? "REST") : undefined,
      outputGuardEnabled: input.stepKey === "output_guard_enabled" && input.state === "COMPLETED" ? true : undefined,
      completedAt: count >= ONBOARDING_STEPS.length ? new Date() : null,
    },
  });
  return event;
}

export async function recordProductEvent(input: {
  eventType: string;
  organizationId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  properties?: Record<string, unknown>;
}) {
  return db.productEvent.create({
    data: {
      eventType: input.eventType,
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      properties: sanitizeMetadata(input.properties) as Prisma.InputJsonValue,
    },
  });
}

export async function markGuardActivation(input: {
  organizationId: string;
  projectId: string;
  userId?: string;
  action: GuardAction;
}) {
  const now = new Date();
  const onboarding = await db.customerOnboarding.findFirst({
    where: { organizationId: input.organizationId, OR: [{ projectId: input.projectId }, { projectId: null }] },
    orderBy: { createdAt: "asc" },
  });
  if (onboarding) {
    await db.$transaction([
      db.customerOnboarding.update({
        where: { id: onboarding.id },
        data: {
          projectId: input.projectId,
          firstGuardRequestAt: onboarding.firstGuardRequestAt ?? now,
          firstBlockedEventAt: input.action === "BLOCK" ? onboarding.firstBlockedEventAt ?? now : undefined,
        },
      }),
      db.onboardingStepEvent.upsert({
        where: { onboardingId_stepKey: { onboardingId: onboarding.id, stepKey: "first_guarded_request" } },
        create: { onboardingId: onboarding.id, stepKey: "first_guarded_request", state: "COMPLETED" },
        update: { state: "COMPLETED" },
      }),
    ]);
  }
  await recordProductEvent({
    eventType: input.action === "BLOCK" ? "guard.first_block_candidate" : "guard.request",
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    properties: { action: input.action },
  });
}

export function onboardingProgress(stepKeys: string[]) {
  const unique = new Set(stepKeys.filter((key) => ONBOARDING_STEPS.includes(key as OnboardingStepKey)));
  return { completed: unique.size, total: ONBOARDING_STEPS.length, percent: Math.round((unique.size / ONBOARDING_STEPS.length) * 100) };
}
