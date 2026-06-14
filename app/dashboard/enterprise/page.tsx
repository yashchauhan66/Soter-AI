import Link from "next/link";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EnterprisePage() {
  const active = await getActiveOrganization();
  if (!active) return <p>No active organization.</p>;
  const [providers, tokens] = await Promise.all([
    db.samlProvider.findMany({ where: { organizationId: active.org.id } }),
    db.scimToken.findMany({
      where: { organizationId: active.org.id },
      select: { id: true, name: true, tokenPreview: true, expiresAt: true, revokedAt: true },
    }),
  ]);
  return (
    <div>
      <p className="eyebrow">Enterprise controls</p>
      <h1 className="mt-2 text-3xl font-bold">Enterprise readiness</h1>
      <p className="mt-3 text-slate-400">SAML SSO, SCIM v2 provisioning, data retention, security controls, and audit review for enterprise tenants.</p>
      <nav className="mt-5 flex flex-wrap gap-2 text-sm">
        {[
          ["SAML SSO", "/dashboard/enterprise/sso"],
          ["SCIM v2", "/dashboard/enterprise/scim"],
          ["Data retention", "/dashboard/enterprise/data-retention"],
          ["Security", "/dashboard/enterprise/security"],
          ["Audit", "/dashboard/enterprise/audit"],
        ].map(([label, href]) => (
          <Link className="rounded-lg border border-slate-800 px-3 py-2 text-slate-300 hover:border-cyan-500/50" href={href} key={href}>{label}</Link>
        ))}
      </nav>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">SAML providers</h2>
          <p className="mt-2 text-sm text-slate-400">Configure via <code>POST /api/enterprise/saml</code>.</p>
          {providers.map((provider) => <p className="mt-3 text-sm" key={provider.id}>{provider.entityId} - {provider.enabled ? "enabled" : "disabled"}</p>)}
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">SCIM tokens</h2>
          <p className="mt-2 text-sm text-slate-400">Generate via <code>POST /api/enterprise/scim-tokens</code>. Raw tokens are returned once.</p>
          {tokens.map((token) => <p className="mt-3 text-sm" key={token.id}>{token.name} - {token.tokenPreview}</p>)}
        </section>
      </div>
    </div>
  );
}
