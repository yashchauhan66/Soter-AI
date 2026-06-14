import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EnterpriseSsoPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;
  const provider = await db.samlProvider.findFirst({ where: { organizationId: active.org.id } });
  const recentAttempts = await db.samlLoginAttempt.findMany({
    where: { organizationId: active.org.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return (
    <div>
      <p className="eyebrow">Enterprise identity</p>
      <h1 className="mt-2 text-3xl font-bold">SAML SSO</h1>
      <p className="mt-3 max-w-3xl text-slate-400">
        SAML 2.0 with metadata upload, JIT provisioning, signature verification, audience/issuer/timing checks, and replay protection. Configure via <code>POST /api/enterprise/saml</code>. SP metadata is at <code>/api/sso/saml/metadata</code>. Login flow lives at <code>/api/sso/saml/login?org={`{slug}`}</code>.
      </p>
      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Service provider details</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">SP entity id</dt><dd className="break-all text-right">{process.env.SAML_SP_ENTITY_ID ?? "(metadata URL default)"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">ACS URL</dt><dd className="break-all text-right">{process.env.SAML_SP_ACS_URL ?? "(NEXTAUTH_URL/api/sso/saml/acs)"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Metadata URL</dt><dd className="break-all text-right">/api/sso/saml/metadata</dd></div>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Identity provider</h2>
          {provider ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd>{provider.enabled ? "Enabled" : "Disabled"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">IdP entity id</dt><dd className="break-all text-right">{provider.entityId}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">SSO URL</dt><dd className="break-all text-right">{provider.ssoUrl}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Default role</dt><dd>{provider.defaultRole}</dd></div>
              {provider.emailDomain ? (
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Restricted to domain</dt><dd>{provider.emailDomain}</dd></div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">SAML is not configured. POST a metadata XML or manual configuration to <code>/api/enterprise/saml</code>.</p>
          )}
        </div>
      </section>
      <section className="mt-6 card p-5">
        <h2 className="font-semibold">Recent SAML login attempts</h2>
        {recentAttempts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No SAML attempts yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-2 text-left">When</th><th className="py-2 text-left">Email</th><th className="py-2 text-left">Status</th><th className="py-2 text-left">Error</th></tr></thead>
            <tbody>
              {recentAttempts.map((attempt) => (
                <tr key={attempt.id} className="border-t border-slate-800">
                  <td className="py-2 text-slate-400">{attempt.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                  <td className="py-2">{attempt.email ?? "-"}</td>
                  <td className="py-2">{attempt.status}</td>
                  <td className="py-2 text-slate-400">{attempt.error ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
