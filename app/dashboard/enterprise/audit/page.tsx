import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EnterpriseAuditPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;
  const [auditLogs, securityEvents] = await Promise.all([
    db.organizationAuditLog.findMany({ where: { organizationId: active.org.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.securityEvent.findMany({ where: { organizationId: active.org.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return (
    <div>
      <p className="eyebrow">Enterprise audit</p>
      <h1 className="mt-2 text-3xl font-bold">Audit and security events</h1>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Organization audit log</h2>
          <div className="mt-4 space-y-2 text-sm">
            {auditLogs.length === 0 ? <p className="text-slate-400">No audit events.</p> : auditLogs.map((event) => (
              <div className="border-t border-slate-800 py-2" key={event.id}>
                <p>{event.action}</p>
                <p className="text-xs text-slate-500">{event.category} - {event.createdAt.toISOString()}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">Security events</h2>
          <div className="mt-4 space-y-2 text-sm">
            {securityEvents.length === 0 ? <p className="text-slate-400">No security events.</p> : securityEvents.map((event) => (
              <div className="border-t border-slate-800 py-2" key={event.id}>
                <p>{event.eventType} - {event.severity}</p>
                <p className="text-xs text-slate-500">{event.action} - {event.createdAt.toISOString()}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
