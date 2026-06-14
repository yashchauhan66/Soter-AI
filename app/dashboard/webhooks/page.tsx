import dynamicImport from "next/dynamic";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

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
      <p className="eyebrow">Event delivery</p>
      <h1 className="mt-2 text-3xl font-bold">Webhooks</h1>
      <p className="mb-7 mt-3 text-slate-400">
        Receive signed notifications when the guard blocks risk or hits usage limits. Payloads never include raw secrets.
      </p>
      <WebhookManager projects={projects} endpoints={safeEndpoints} />
    </div>
  );
}
