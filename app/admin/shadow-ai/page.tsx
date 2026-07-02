import { db } from "@/lib/db";
import { ShadowAIDashboardClient } from "@/components/admin/ShadowAIDashboardClient";

export const dynamic = "force-dynamic";

export default async function ShadowAIDiscoveryPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, name: true },
  });

  // Fetch shadow AI discovery events
  const shadowEvents = await db.securityEvent.findMany({
    where: { eventType: "EXTENSION_SHADOW_AI_DISCOVERED" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { organization: { select: { name: true } } },
  });

  const parsedEvents = shadowEvents.map((event) => {
    const meta = (event.metadata as Record<string, unknown>) ?? {};
    return {
      id: event.id,
      organizationId: event.organizationId,
      organizationName: event.organization?.name ?? "—",
      domain: (meta.domain as string) ?? "unknown",
      destination: (meta.destination as string) ?? "Unknown AI Tool",
      employeeId: (meta.employeeId as string) ?? "—",
      riskLevel: (meta.riskLevel as string) ?? "medium",
      createdAt: event.createdAt.toISOString(),
    };
  });

  // Aggregate by domain
  const domainMap = new Map<string, {
    domain: string; destination: string; riskLevel: string;
    organizations: Set<string>; departments: Set<string>; employees: Set<string>;
    firstSeen: Date; lastSeen: Date; eventCount: number; isKnown: boolean;
  }>();

  const KNOWN_AI_DOMAINS = [
    "chatgpt.com", "chat.openai.com", "claude.ai", "gemini.google.com",
    "perplexity.ai", "poe.com", "copilot.microsoft.com", "huggingface.co",
    "api.openai.com", "api.anthropic.com",
  ];

  for (const event of shadowEvents) {
    const meta = (event.metadata as Record<string, unknown>) ?? {};
    const domain = (meta.domain as string) ?? "unknown";
    const existing = domainMap.get(domain);
    if (existing) {
      existing.eventCount++;
      if (event.createdAt > existing.lastSeen) existing.lastSeen = event.createdAt;
      if (event.createdAt < existing.firstSeen) existing.firstSeen = event.createdAt;
      existing.organizations.add(event.organizationId);
      const dept = (meta.department as string) ?? undefined;
      if (dept) existing.departments.add(dept);
      const emp = (meta.employeeId as string) ?? undefined;
      if (emp) existing.employees.add(emp);
    } else {
      const dept = (meta.department as string) ?? undefined;
      const emp = (meta.employeeId as string) ?? undefined;
      domainMap.set(domain, {
        domain, destination: (meta.destination as string) ?? "Unknown AI Tool",
        riskLevel: (meta.riskLevel as string) ?? "medium",
        organizations: new Set([event.organizationId]),
        departments: new Set(dept ? [dept] : []),
        employees: new Set(emp ? [emp] : []),
        firstSeen: event.createdAt, lastSeen: event.createdAt, eventCount: 1,
        isKnown: KNOWN_AI_DOMAINS.includes(domain),
      });
    }
  }

  const destinations = [...domainMap.values()].map((d) => ({
    ...d,
    firstSeen: d.firstSeen.toISOString(),
    lastSeen: d.lastSeen.toISOString(),
    organizations: [...d.organizations],
    departments: [...d.departments], employees: [...d.employees],
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Shadow AI Discovery</h1>
        <p className="mt-1 text-sm text-slate-400">
          Discover and manage AI tools being used across the organization. Review unknown destinations, classify risk, and enforce policy.
        </p>
      </div>
      <ShadowAIDashboardClient
        organizations={organizations}
        initialDestinations={destinations}
        initialEvents={parsedEvents}
      />
    </div>
  );
}
