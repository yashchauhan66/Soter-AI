import Link from "next/link";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const AUDIT_PAGE_SIZE = 50;
const SECURITY_EVENT_PAGE_SIZE = 50;

function parseCursorDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function auditHref(params: { auditCursor?: Date; eventCursor?: Date }) {
  const query = new URLSearchParams();
  if (params.auditCursor) query.set("auditCursor", params.auditCursor.toISOString());
  if (params.eventCursor) query.set("eventCursor", params.eventCursor.toISOString());
  const suffix = query.toString();
  return suffix ? `/dashboard/enterprise/audit?${suffix}` : "/dashboard/enterprise/audit";
}

export default async function EnterpriseAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ auditCursor?: string; eventCursor?: string }>;
}) {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;
  const params = await searchParams;
  const auditCursor = parseCursorDate(params.auditCursor);
  const eventCursor = parseCursorDate(params.eventCursor);
  const [auditRows, securityEventRows] = await Promise.all([
    db.organizationAuditLog.findMany({
      where: { organizationId: active.org.id, ...(auditCursor ? { createdAt: { lt: auditCursor } } : {}) },
      orderBy: { createdAt: "desc" },
      take: AUDIT_PAGE_SIZE + 1,
      select: { id: true, action: true, category: true, createdAt: true },
    }),
    db.securityEvent.findMany({
      where: { organizationId: active.org.id, ...(eventCursor ? { createdAt: { lt: eventCursor } } : {}) },
      orderBy: { createdAt: "desc" },
      take: SECURITY_EVENT_PAGE_SIZE + 1,
      select: { id: true, eventType: true, severity: true, action: true, createdAt: true },
    }),
  ]);
  const hasMoreAuditLogs = auditRows.length > AUDIT_PAGE_SIZE;
  const hasMoreSecurityEvents = securityEventRows.length > SECURITY_EVENT_PAGE_SIZE;
  const auditLogs = auditRows.slice(0, AUDIT_PAGE_SIZE);
  const securityEvents = securityEventRows.slice(0, SECURITY_EVENT_PAGE_SIZE);

  return (
    <div>
      <p className="eyebrow">Enterprise audit</p>
      <h1 className="mt-2 text-3xl font-bold">Audit and security events</h1>
      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Organization audit log</h2>
            {hasMoreAuditLogs && (
              <Link
                className="text-sm font-semibold text-cyan"
                href={auditHref({ auditCursor: auditLogs.at(-1)?.createdAt, eventCursor })}
              >
                Next audit events
              </Link>
            )}
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {auditLogs.length === 0 ? (
              <p className="text-slate-400">No audit events.</p>
            ) : (
              auditLogs.map((event) => (
                <div className="border-t border-slate-800 py-2" key={event.id}>
                  <p>{event.action}</p>
                  <p className="text-xs text-slate-500">
                    {event.category} - {event.createdAt.toISOString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Security events</h2>
            {hasMoreSecurityEvents && (
              <Link
                className="text-sm font-semibold text-cyan"
                href={auditHref({ auditCursor, eventCursor: securityEvents.at(-1)?.createdAt })}
              >
                Next security events
              </Link>
            )}
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {securityEvents.length === 0 ? (
              <p className="text-slate-400">No security events.</p>
            ) : (
              securityEvents.map((event) => (
                <div className="border-t border-slate-800 py-2" key={event.id}>
                  <p>
                    {event.eventType} - {event.severity}
                  </p>
                  <p className="text-xs text-slate-500">
                    {event.action} - {event.createdAt.toISOString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
