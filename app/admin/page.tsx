import Link from "next/link";
import { db } from "@/lib/db";
import { AdminActionForm } from "@/components/admin/AdminActionForm";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [
    totalUsers,
    totalOrgs,
    totalProjects,
    totalLogs,
    blocked24h,
    failedDeliveries,
    activeSubs,
    recentOrgs,
    recentEvents,
    quarantinedDocuments,
    disabledProjects,
    recentFeedback,
    recentAdminAudits,
  ] = await Promise.all([
    db.user.count(),
    db.organization.count(),
    db.project.count(),
    db.guardLog.count(),
    db.guardLog.count({
      where: { action: "BLOCK", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    db.webhookDelivery.count({ where: { status: { in: ["FAILED", "DEAD_LETTER"] } } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
    db.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { _count: { select: { projects: true, members: true } }, subscription: true },
    }),
    db.paymentEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 10 }),
    db.ragDocument.count({ where: { status: "QUARANTINED" } }),
    db.project.count({ where: { disabledAt: { not: null } } }),
    db.detectionFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { project: { select: { name: true } } } }),
    db.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { adminUser: { select: { email: true } } } }),
  ]);

  const tiles: Array<[string, number | string]> = [
    ["Users", totalUsers],
    ["Organizations", totalOrgs],
    ["Projects", totalProjects],
    ["Total guard logs", totalLogs],
    ["Blocks (24h)", blocked24h],
    ["Failed webhook deliveries", failedDeliveries],
    ["Active subscriptions", activeSubs],
    ["Quarantined RAG docs", quarantinedDocuments],
    ["Disabled projects", disabledProjects],
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold">System overview</h1>
      <p className="mt-2 text-slate-400">High-level health for product owners. No raw user content surfaces here.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div className="card p-5" key={label}>
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-9 text-lg font-semibold">Recent organizations</h2>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Projects</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {recentOrgs.map((org) => (
              <tr key={org.id}>
                <td className="px-4 py-3 font-semibold">{org.name}</td>
                <td className="px-4 py-3">{org.type}</td>
                <td className="px-4 py-3">{org.plan}</td>
                <td className="px-4 py-3">{org.subscription?.status ?? "-"}</td>
                <td className="px-4 py-3">{org._count.members}</td>
                <td className="px-4 py-3">{org._count.projects}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(org.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-9 text-lg font-semibold">Recent payment events</h2>
      {recentEvents.length ? (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Org</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Signature valid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3 text-slate-400">{new Date(event.receivedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{event.organizationId ?? "-"}</td>
                  <td className="px-4 py-3">{event.eventType}</td>
                  <td className={`px-4 py-3 ${event.signatureValid ? "text-emerald-300" : "text-red-300"}`}>{event.signatureValid ? "valid" : "invalid"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No payment events yet.</p>
      )}

      <p className="mt-9 text-xs text-slate-600">
        Tip: visit <Link href="/dashboard" className="text-cyan">/dashboard</Link> for tenant-scoped views.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5"><h2 className="font-semibold">Recent detection feedback</h2><div className="mt-3 space-y-2 text-sm">{recentFeedback.map((item) => <div key={item.id} className="rounded-xl bg-slate-950/60 p-3"><p>{item.feedback} · {item.project.name}</p><p className="text-xs text-slate-500">{item.note ?? "No note"}</p></div>)}</div></section>
        <section className="card p-5"><h2 className="font-semibold">Recent admin audit</h2><div className="mt-3 space-y-2 text-sm">{recentAdminAudits.map((item) => <div key={item.id} className="rounded-xl bg-slate-950/60 p-3"><p>{item.action} · {item.targetType}</p><p className="text-xs text-slate-500">{item.adminUser?.email ?? "system"} · {item.reason}</p></div>)}</div></section>
      </div>
      <AdminActionForm />
    </div>
  );
}
