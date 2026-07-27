import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { defaultExtensionPolicy } from "@/app/api/extension/_shared";
import { listPolicies } from "@/lib/admin-ai-policies/store";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ExtensionEnrollPanel } from "@/components/dashboard/extension/ExtensionEnrollPanel";
import { ExtensionDevicesPanel } from "@/components/dashboard/extension/ExtensionDevicesPanel";
import { ExtensionPolicyPanel } from "@/components/dashboard/extension/ExtensionPolicyPanel";
import { ExtensionActivityPanel } from "@/components/dashboard/extension/ExtensionActivityPanel";

export const dynamic = "force-dynamic";

const MANAGED_POLICY_NAME = "Browser Extension (managed)";
const MANAGED_ACTIONS = ["block", "redact", "warn", "log_only", "require_approval"] as const;

export default async function BrowserExtensionPage() {
  const active = await getActiveOrganization();

  if (!active) {
    return (
      <div className="space-y-4">
        <p className="eyebrow">Browser Extension</p>
        <h1 className="text-3xl font-bold">Browser Extension</h1>
        <section className="card p-6 text-slate-400">
          Create an organization first to deploy and manage the SoterAI browser extension.
        </section>
      </div>
    );
  }

  const organizationId = active.org.id;

  const [devices, tokens, events, policies, org] = await Promise.all([
    db.deviceAgent.findMany({
      where: { organizationId, type: "browser_extension" },
      orderBy: { lastHeartbeatAt: "desc" },
      take: 100,
      select: {
        id: true, employeeEmail: true, department: true, role: true, platform: true,
        version: true, status: true, lastHeartbeatAt: true, policyVersion: true, createdAt: true,
      },
    }),
    db.extensionEnrollmentToken.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, employeeEmail: true, department: true, role: true, maxUses: true,
        usedCount: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true,
      },
    }),
    db.securityEvent.findMany({
      where: { organizationId, source: "extension" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, eventType: true, severity: true, action: true, riskTypes: true, metadata: true, createdAt: true },
    }),
    listPolicies(organizationId),
    db.organization.findUnique({ where: { id: organizationId }, select: { extensionSeatLimit: true } }),
  ]);

  const seatLimit = org?.extensionSeatLimit ?? null;
  const activeDevices = devices.filter((d) => d.status === "active").length;
  const activeCodes = tokens.filter(
    (t) => !t.revokedAt && t.expiresAt > new Date() && t.usedCount < t.maxUses,
  ).length;
  const blockedEvents = events.filter((e) => e.action === "BLOCK").length;

  const managed = policies.find((p) => p.name === MANAGED_POLICY_NAME);
  const fallback = defaultExtensionPolicy(organizationId);
  const initialSettings = {
    enabled: managed?.enabled ?? true,
    action: (MANAGED_ACTIONS as readonly string[]).includes(managed?.action ?? "")
      ? (managed!.action as (typeof MANAGED_ACTIONS)[number])
      : ("block" as const),
    monitoredDomains: managed?.destinations.domains.length ? managed.destinations.domains : fallback.monitoredDomains,
    scanResponses: managed?.detectionConfig.scanResponses ?? false,
  };

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">AI Usage Governance</p>
        <h1 className="mt-2 text-3xl font-bold">Browser Extension</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Deploy the SoterAI browser extension across your team to stop secrets, PII, and source code
          from leaking into ChatGPT, Claude, Gemini, and 20+ other AI tools. Enroll browsers, manage
          devices, tune policy, and watch activity — all from here.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Licensed seats"
          value={seatLimit === null ? `${activeDevices} / ∞` : `${activeDevices} / ${seatLimit}`}
          tone={seatLimit !== null && activeDevices >= seatLimit ? "red" : "green"}
        />
        <MetricCard label="Enrolled total" value={devices.length} tone="cyan" />
        <MetricCard label="Active enrollment codes" value={activeCodes} tone="yellow" />
        <MetricCard label="Blocked leaks (recent)" value={blockedEvents} tone="red" />
      </div>

      <ExtensionEnrollPanel
        organizationId={organizationId}
        initialTokens={tokens.map((t) => ({
          id: t.id,
          employeeEmail: t.employeeEmail,
          department: t.department,
          role: t.role,
          maxUses: t.maxUses,
          usedCount: t.usedCount,
          expiresAt: t.expiresAt.toISOString(),
          revokedAt: t.revokedAt?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
        }))}
      />

      <ExtensionDevicesPanel
        organizationId={organizationId}
        devices={devices.map((d) => ({
          id: d.id,
          employeeEmail: d.employeeEmail,
          department: d.department,
          role: d.role,
          platform: d.platform,
          version: d.version,
          status: d.status,
          policyVersion: d.policyVersion,
          lastHeartbeatAt: d.lastHeartbeatAt?.toISOString() ?? null,
          createdAt: d.createdAt.toISOString(),
        }))}
      />

      <ExtensionPolicyPanel organizationId={organizationId} initialSettings={initialSettings} />

      <ExtensionActivityPanel
        events={events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          severity: e.severity,
          action: e.action,
          riskTypes: e.riskTypes,
          domain: (e.metadata as { domain?: string } | null)?.domain ?? null,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
