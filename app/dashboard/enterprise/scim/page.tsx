import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EnterpriseScimPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;
  const [tokens, groups, events] = await Promise.all([
    db.scimToken.findMany({
      where: { organizationId: active.org.id },
      select: { id: true, name: true, tokenPreview: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.scimGroupMapping.findMany({ where: { organizationId: active.org.id }, orderBy: { displayName: "asc" } }),
    db.organizationAuditLog.findMany({ where: { organizationId: active.org.id, category: "scim" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  return (
    <div>
      <p className="eyebrow">Enterprise provisioning</p>
      <h1 className="mt-2 text-3xl font-bold">SCIM v2</h1>
      <p className="mt-3 max-w-3xl text-slate-400">
        Bearer-token SCIM provisioning for Users and Groups. Raw tokens are shown only once when generated through <code>POST /api/enterprise/scim-tokens</code>.
      </p>

      <section className="mt-6 card p-5">
        <h2 className="font-semibold">Endpoints</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          {["/api/scim/v2/ServiceProviderConfig", "/api/scim/v2/ResourceTypes", "/api/scim/v2/Schemas", "/api/scim/v2/Users", "/api/scim/v2/Groups"].map((path) => (
            <code className="rounded-lg bg-slate-950/70 p-3 text-cyan-100" key={path}>{baseUrl}{path}</code>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Tokens</h2>
          <div className="mt-4 space-y-3 text-sm">
            {tokens.length === 0 ? <p className="text-slate-400">No SCIM tokens generated.</p> : tokens.map((token) => (
              <div className="rounded-lg border border-slate-800 p-3" key={token.id}>
                <p className="font-medium">{token.name}</p>
                <p className="text-slate-400">{token.tokenPreview} · {token.revokedAt ? "revoked" : "active"} · last used {token.lastUsedAt?.toISOString() ?? "never"}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Group role mapping</h2>
          <div className="mt-4 space-y-3 text-sm">
            {groups.length === 0 ? <p className="text-slate-400">Groups provisioned by the IdP will appear here.</p> : groups.map((group) => (
              <div className="rounded-lg border border-slate-800 p-3" key={group.id}>
                <p className="font-medium">{group.displayName}</p>
                <p className="text-slate-400">Maps to {group.role} · {Array.isArray(group.members) ? group.members.length : 0} member references</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 card p-5">
        <h2 className="font-semibold">Recent SCIM events</h2>
        <div className="mt-4 space-y-2 text-sm">
          {events.length === 0 ? <p className="text-slate-400">No SCIM audit events yet.</p> : events.map((event) => (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 py-2" key={event.id}>
              <span>{event.action}</span>
              <span className="text-slate-500">{event.createdAt.toISOString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
