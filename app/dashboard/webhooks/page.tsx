import dynamicImport from "next/dynamic";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

const WebhookManager = dynamicImport(() => import("@/components/dashboard/WebhookManager").then((mod) => mod.WebhookManager));

export default async function WebhooksPage() {
  const user = await getCurrentUser();
  const [projects, endpoints] = await Promise.all([
    db.project.findMany({ where: { userId: user.id }, select: { id: true, name: true }, take: 50 }),
    db.webhookEndpoint.findMany({
      where: { project: { userId: user.id } },
      select: {
        id: true,
        projectId: true,
        url: true,
        description: true,
        secretPreview: true,
        events: true,
        isActive: true,
        createdAt: true,
        project: { select: { name: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const safeEndpoints = endpoints.map((rest) => ({
    ...rest,
    createdAt: rest.createdAt.toISOString(),
  }));
  return (
    <div>
      <PageHeader
        eyebrow="Event delivery"
        title="Webhooks"
        description="Receive signed notifications when the guard blocks risk or hits usage limits. Payloads never include raw secrets."
      />
      <WebhookManager projects={projects} endpoints={safeEndpoints} />
    </div>
  );
}
