import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { BUILT_IN_AI_DESTINATIONS } from "@/packages/shared/src/ai-destinations";

export const dynamic = "force-dynamic";

const discoveryEventSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  domain: z.string().trim().min(1).max(300),
  destination: z.string().trim().min(1).max(200),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  department: z.string().trim().max(100).optional(),
  employeeId: z.string().trim().max(200).optional(),
});

// Known AI domains that are already managed
const KNOWN_AI_DOMAINS = new Set(
  BUILT_IN_AI_DESTINATIONS.flatMap((d) => d.domains)
);

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    const department = url.searchParams.get("department");

    const where: Record<string, unknown> = {
      eventType: "EXTENSION_SHADOW_AI_DISCOVERED",
    };
    if (organizationId) where.organizationId = organizationId;

    const events = await db.securityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { organization: { select: { name: true } } },
    });

    // Group by domain for dashboard view
    const domainMap = new Map<string, {
      domain: string;
      destination: string;
      riskLevel: string;
      organizations: Set<string>;
      departments: Set<string>;
      employees: Set<string>;
      firstSeen: Date;
      lastSeen: Date;
      eventCount: number;
      isKnown: boolean;
    }>();

    for (const event of events) {
      const meta = (event.metadata as Record<string, unknown>) ?? {};
      const domain = (meta.domain as string) ?? "unknown";
      const dept = (meta.department as string) ?? undefined;

      if (department && dept !== department) continue;

      const existing = domainMap.get(domain);
      if (existing) {
        existing.eventCount++;
        if (event.createdAt > existing.lastSeen) existing.lastSeen = event.createdAt;
        if (event.createdAt < existing.firstSeen) existing.firstSeen = event.createdAt;
        existing.organizations.add(event.organizationId);
        if (dept) existing.departments.add(dept);
        const emp = (meta.employeeId as string) ?? undefined;
        if (emp) existing.employees.add(emp);
      } else {
        const emp = (meta.employeeId as string) ?? undefined;
        domainMap.set(domain, {
          domain,
          destination: (meta.destination as string) ?? "Unknown AI Tool",
          riskLevel: (meta.riskLevel as string) ?? "medium",
          organizations: new Set([event.organizationId]),
          departments: new Set(dept ? [dept] : []),
          employees: new Set(emp ? [emp] : []),
          firstSeen: event.createdAt,
          lastSeen: event.createdAt,
          eventCount: 1,
          isKnown: KNOWN_AI_DOMAINS.has(domain),
        });
      }
    }

    const destinations = [...domainMap.values()].map((d) => ({
      ...d,
      organizations: [...d.organizations],
      departments: [...d.departments],
      employees: [...d.employees],
    }));

    return jsonResponse({ destinations, totalCount: destinations.length });
  } catch (error) {
    return apiError(error, "Shadow AI discovery data could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const body = discoveryEventSchema.parse(await readJson(request));

    const event = await db.securityEvent.create({
      data: {
        organizationId: body.organizationId,
        eventType: "EXTENSION_SHADOW_AI_DISCOVERED",
        severity: body.riskLevel === "high" || body.riskLevel === "critical" ? "HIGH" : "MEDIUM",
        riskTypes: ["SHADOW_AI_DISCOVERED"],
        action: "DISCOVERED",
        source: "extension.shadow-ai",
        metadata: {
          domain: body.domain,
          destination: body.destination,
          riskLevel: body.riskLevel,
          department: body.department ?? null,
          employeeId: body.employeeId ?? null,
          known: KNOWN_AI_DOMAINS.has(body.domain),
        },
      },
    });

    return jsonResponse({ ok: true, eventId: event.id });
  } catch (error) {
    return apiError(error, "Shadow AI discovery event could not be recorded.");
  }
}
