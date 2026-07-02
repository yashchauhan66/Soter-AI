import { db } from "@/lib/db";
import { SIEM_WEBHOOK_EVENT_TYPES } from "@/lib/siem/webhooks";
import { SiemWebhooksClient } from "@/components/admin/SiemWebhooksClient";

export const dynamic = "force-dynamic";

export default async function SiemWebhooksPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, name: true },
  });

  const firstOrgId = organizations[0]?.id ?? null;

  const integrations = firstOrgId
    ? await db.siemIntegration.findMany({
        where: { organizationId: firstOrgId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { deliveries: true } } },
      })
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">SIEM / Webhook Integrations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Forward security events to your SIEM or custom webhook endpoints. All payloads are HMAC-SHA256 signed and redacted by default.
        </p>
      </div>

      <SiemWebhooksClient
        organizations={organizations}
        initialIntegrations={integrations.map((i) => ({
          id: i.id,
          name: i.name,
          endpointUrl: i.endpointUrl,
          enabled: i.enabled,
          maxAttempts: i.maxAttempts,
          deliveryCount: i._count.deliveries,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
        }))}
        eventTypes={[...SIEM_WEBHOOK_EVENT_TYPES]}
      />
    </div>
  );
}
