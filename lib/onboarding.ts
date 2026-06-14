import { db } from "./db";
import { getCurrentUser } from "./auth";

export interface OnboardingItem {
  key: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

export async function loadOnboarding() {
  const user = await getCurrentUser();
  const progress = await db.onboardingProgress.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  const [projectCount, apiKeyCount, guardLogCount, webhookCount, badgeEnabledCount, reportCount] = await Promise.all([
    db.project.count({ where: { userId: user.id } }),
    db.apiKey.count({ where: { project: { userId: user.id } } }),
    db.guardLog.count({ where: { project: { userId: user.id } } }),
    db.webhookEndpoint.count({ where: { project: { userId: user.id } } }),
    db.project.count({ where: { userId: user.id, badgeEnabled: true } }),
    db.report.count({ where: { project: { userId: user.id } } }),
  ]);

  const items: OnboardingItem[] = [
    {
      key: "project",
      title: "Create a project",
      description: "Group everything (keys, logs, webhooks, badge) under a project.",
      href: "/dashboard/projects/new",
      done: projectCount > 0 || progress.projectCreated,
    },
    {
      key: "apiKey",
      title: "Generate an API key",
      description: "Issue a scoped, peppered-hashed key. The raw value is shown once.",
      href: "/dashboard/api-keys",
      done: apiKeyCount > 0 || progress.apiKeyGenerated,
    },
    {
      key: "firstRequest",
      title: "Send your first guarded request",
      description: "Hit /api/guard/input from your app, the SDK, or the playground.",
      href: "/playground",
      done: guardLogCount > 0 || progress.firstGuardRequest,
    },
    {
      key: "webhook",
      title: "Configure a webhook",
      description: "Receive signed events for blocked risks and usage limits.",
      href: "/dashboard/webhooks",
      done: webhookCount > 0 || progress.webhookConfigured,
    },
    {
      key: "badge",
      title: "Enable a security badge",
      description: "Display defensive coverage on your marketing or chat surface.",
      href: "/dashboard/projects",
      done: badgeEnabledCount > 0 || progress.badgeEnabled,
    },
    {
      key: "report",
      title: "Generate your first report",
      description: "Inspect monthly stats or print a branded white-label PDF.",
      href: "/dashboard/reports",
      done: reportCount > 0 || progress.reportGenerated,
    },
    {
      key: "sdk",
      title: "Install the SDK",
      description: "npm install @cyberrakshak/guard for a typed client and Next.js helper.",
      href: "/docs#sdk",
      done: progress.sdkInstalled,
    },
  ];

  const done = items.filter((item) => item.done).length;
  return { items, done, total: items.length, percent: Math.round((done / items.length) * 100) };
}
