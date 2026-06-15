import Link from "next/link";
import { IncidentForm } from "@/components/phase8/AdminPhase8Forms";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const TICKET_PAGE_SIZE = 25;
const INCIDENT_PAGE_SIZE = 20;

function parseCursorDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function adminSupportHref(params: { ticketCursor?: Date; incidentCursor?: Date }) {
  const query = new URLSearchParams();
  if (params.ticketCursor) query.set("ticketCursor", params.ticketCursor.toISOString());
  if (params.incidentCursor) query.set("incidentCursor", params.incidentCursor.toISOString());
  const suffix = query.toString();
  return suffix ? `/admin/support?${suffix}` : "/admin/support";
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticketCursor?: string; incidentCursor?: string }>;
}) {
  const params = await searchParams;
  const ticketCursor = parseCursorDate(params.ticketCursor);
  const incidentCursor = parseCursorDate(params.incidentCursor);
  const [ticketRows, incidentRows] = await Promise.all([
    db.supportTicket.findMany({
      where: ticketCursor ? { updatedAt: { lt: ticketCursor } } : undefined,
      orderBy: { updatedAt: "desc" },
      take: TICKET_PAGE_SIZE + 1,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        category: true,
        priority: true,
        updatedAt: true,
        organization: { select: { name: true } },
        createdBy: { select: { email: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
      },
    }),
    db.incident.findMany({
      where: incidentCursor ? { startedAt: { lt: incidentCursor } } : undefined,
      orderBy: { startedAt: "desc" },
      take: INCIDENT_PAGE_SIZE + 1,
      select: { id: true, title: true, status: true, summary: true, startedAt: true },
    }),
  ]);
  const hasMoreTickets = ticketRows.length > TICKET_PAGE_SIZE;
  const hasMoreIncidents = incidentRows.length > INCIDENT_PAGE_SIZE;
  const tickets = ticketRows.slice(0, TICKET_PAGE_SIZE);
  const incidents = incidentRows.slice(0, INCIDENT_PAGE_SIZE);

  return (
    <div>
      <p className="eyebrow">Support operations</p>
      <h1 className="mt-2 text-3xl font-bold">Tickets and incidents</h1>
      <div className="mt-7 grid gap-8 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Ticket queue</h2>
            {hasMoreTickets && (
              <Link
                className="text-sm font-semibold text-cyan"
                href={adminSupportHref({ ticketCursor: tickets.at(-1)?.updatedAt, incidentCursor })}
              >
                Next tickets
              </Link>
            )}
          </div>
          <div className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
            {tickets.map((ticket) => (
              <article className="py-4" key={ticket.id}>
                <div className="flex justify-between gap-3">
                  <p className="font-semibold">
                    {ticket.ticketNumber} - {ticket.subject}
                  </p>
                  <span className="text-sm text-cyan">{ticket.status}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {ticket.organization.name} - {ticket.createdBy.email} - {ticket.category} - {ticket.priority}
                </p>
                <p className="mt-2 text-sm text-slate-300">{ticket.messages[0]?.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Incident timeline</h2>
            {hasMoreIncidents && (
              <Link
                className="text-sm font-semibold text-cyan"
                href={adminSupportHref({ ticketCursor, incidentCursor: incidents.at(-1)?.startedAt })}
              >
                Next incidents
              </Link>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {incidents.map((incident) => (
              <section className="card p-4" key={incident.id}>
                <div className="flex justify-between">
                  <p className="font-semibold">{incident.title}</p>
                  <span className="text-sm">{incident.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{incident.summary}</p>
              </section>
            ))}
          </div>
        </div>
        <aside>
          <h2 className="mb-4 text-lg font-semibold">Open incident</h2>
          <IncidentForm />
        </aside>
      </div>
    </div>
  );
}
