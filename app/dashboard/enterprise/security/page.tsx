import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EnterpriseSecurityPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;
  const [organization, allowlist, sessions] = await Promise.all([
    db.organization.findUnique({ where: { id: active.org.id }, select: { ipAllowlistEnabled: true, apiKeyRotationDays: true, quotaOverride: true, disabled: true, disabledReason: true } }),
    db.ipAllowlistEntry.findMany({ where: { organizationId: active.org.id }, orderBy: { createdAt: "desc" } }),
    db.userSession.findMany({ where: { organizationId: active.org.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return (
    <div>
      <p className="eyebrow">Enterprise controls</p>
      <h1 className="mt-2 text-3xl font-bold">Security settings</h1>
      <p className="mt-3 max-w-3xl text-slate-400">IP allowlist, session revocation, API key rotation, quotas, and tenant disable controls are enforced through <code>/api/enterprise/security</code>.</p>
      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="font-semibold">Network</h2>
          <p className="mt-3 text-sm text-slate-400">IP allowlist is {organization?.ipAllowlistEnabled ? "enabled" : "disabled"}.</p>
          <div className="mt-4 space-y-2 text-sm">{allowlist.map((entry) => <p key={entry.id}>{entry.cidr} <span className="text-slate-500">{entry.label ?? ""}</span></p>)}</div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Keys and quotas</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Rotation policy</dt><dd>{organization?.apiKeyRotationDays ? `${organization.apiKeyRotationDays} days` : "Not set"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Quota override</dt><dd>{organization?.quotaOverride ?? "None"}</dd></div>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Tenant state</h2>
          <p className="mt-3 text-sm text-slate-400">{organization?.disabled ? `Disabled: ${organization.disabledReason ?? "No reason recorded"}` : "Organization enabled"}</p>
        </div>
      </section>
      <section className="mt-6 card p-5">
        <h2 className="font-semibold">Sessions</h2>
        <div className="mt-4 space-y-2 text-sm">
          {sessions.length === 0 ? <p className="text-slate-400">No tracked sessions.</p> : sessions.map((session) => (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 py-2" key={session.id}>
              <span>{session.ip ?? "unknown IP"} - {session.userAgent ?? "unknown device"}</span>
              <span className="text-slate-500">{session.revokedAt ? "revoked" : "active"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
