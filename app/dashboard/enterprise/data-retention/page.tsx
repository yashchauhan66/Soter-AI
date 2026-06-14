import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DataRetentionPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;
  const [policy, requests] = await Promise.all([
    db.retentionPolicy.findUnique({ where: { organizationId: active.org.id } }),
    db.dataDeletionRequest.findMany({ where: { organizationId: active.org.id }, include: { jobs: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const confirmation = `DELETE ORGANIZATION ${active.org.slug}`;
  return (
    <div>
      <p className="eyebrow">Enterprise data controls</p>
      <h1 className="mt-2 text-3xl font-bold">Data retention and deletion</h1>
      <p className="mt-3 max-w-3xl text-slate-400">
        Configure tenant retention windows, request deletion workflows, and keep an audit trail. Export review is recommended before destructive deletion.
      </p>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Current retention policy</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Window</dt><dd>{policy?.window ?? "DAYS_30 default"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Custom days</dt><dd>{policy?.customDays ?? "-"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Guard logs</dt><dd>{policy?.applyToLogs ?? true ? "Included" : "Excluded"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Webhook deliveries</dt><dd>{policy?.applyToWebhookDeliveries ? "Included" : "Excluded"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Last cleanup</dt><dd>{policy?.lastRunAt?.toISOString() ?? "Never"}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">Update through <code>PUT /api/enterprise/data-retention</code>. Cleanup runs through <code>POST /api/enterprise/data-retention</code>.</p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Deletion confirmation</h2>
          <p className="mt-3 text-sm text-slate-400">Organization deletion requires owner role and this exact phrase:</p>
          <code className="mt-3 block rounded-lg bg-slate-950/70 p-3 text-rose-100">{confirmation}</code>
          <p className="mt-4 text-xs text-slate-500">Create requests through <code>POST /api/enterprise/data-deletion</code>. Billing/payment records are retained when legally required and marked with a retained reason in downstream jobs.</p>
        </div>
      </section>
      <section className="mt-6 card p-5">
        <h2 className="font-semibold">Deletion requests</h2>
        <div className="mt-4 space-y-3 text-sm">
          {requests.length === 0 ? <p className="text-slate-400">No deletion requests.</p> : requests.map((request) => (
            <div className="rounded-lg border border-slate-800 p-3" key={request.id}>
              <p className="font-medium">{request.scope} - {request.status}</p>
              <p className="text-slate-400">{request.jobs.length} jobs - requested {request.createdAt.toISOString()}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
