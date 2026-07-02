import { db } from "@/lib/db";
import { History, Shield, AlertTriangle, Filter } from "lucide-react";
import { ExtensionEventsClient } from "@/components/admin/ai-policies/ExtensionEventsClient";

export const dynamic = "force-dynamic";

export default async function ExtensionEventsPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, name: true },
  });

  const events = await db.securityEvent.findMany({
    where: {
      eventType: { startsWith: "EXTENSION_" },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { organization: { select: { name: true } } },
  });

  const parsedEvents = events.map((event) => {
    const meta = (event.metadata as Record<string, unknown>) ?? {};
    return {
      id: event.id,
      organizationId: event.organizationId,
      organizationName: event.organization?.name ?? "—",
      eventType: event.eventType.replace("EXTENSION_", "").toLowerCase(),
      severity: event.severity,
      action: event.action,
      source: event.source,
      riskTypes: event.riskTypes,
      employeeId: (meta.employeeId as string) ?? "—",
      domain: (meta.domain as string) ?? "—",
      policyVersion: (meta.policyVersion as string) ?? "—",
      browser: (meta.browser as string) ?? "—",
      extensionVersion: (meta.extensionVersion as string) ?? "—",
      redactedPreview: (meta.redactedPreview as string) ?? null,
      createdAt: event.createdAt.toISOString(),
    };
  });

  return (
    <ExtensionEventsClient
      organizations={organizations}
      initialEvents={parsedEvents}
    />
  );
}
