import { MailCheck, MessageSquareReply, Rocket, Ticket } from "lucide-react";
import { db } from "@/lib/db";
import { AdminQueryReplyForm } from "@/components/admin/AdminQueryReplyForm";

export const dynamic = "force-dynamic";

function timeAgo(date: Date | string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function QueryCard({
  icon: Icon,
  title,
  subtitle,
  meta,
  body,
  children,
}: {
  icon: typeof MailCheck;
  title: string;
  subtitle: string;
  meta: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <article className="card p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-md border border-cyan/20 bg-cyan/10 p-2 text-cyan"><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{title}</h3>
            <span className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-400">{meta}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-300">{body}</p>
          {children}
        </div>
      </div>
    </article>
  );
}

export default async function AdminQueriesPage() {
  const [contacts, pilots, tickets] = await Promise.all([
    db.contactLead.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.enterprisePilot.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.supportTicket.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        organization: { select: { name: true } },
        createdBy: { select: { email: true, name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } },
      },
    }),
  ]);

  const openContacts = contacts.filter((item) => item.status === "NEW").length;
  const openPilots = pilots.filter((item) => item.status === "REQUESTED").length;
  const openTickets = tickets.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status)).length;

  return (
    <div>
      <p className="eyebrow">Customer query inbox</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Queries and replies</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Review inbound contact requests, pilot enquiries, and support tickets. Send replies directly from admin; every send is logged in the admin audit trail.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-2xl font-bold">{openContacts}</p><p className="text-slate-500">new leads</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-2xl font-bold">{openPilots}</p><p className="text-slate-500">pilot requests</p></div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-2xl font-bold">{openTickets}</p><p className="text-slate-500">open tickets</p></div>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquareReply size={18} className="text-cyan" />
          <h2 className="text-lg font-semibold">Contact queries</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {contacts.length ? contacts.map((lead) => (
            <QueryCard
              key={lead.id}
              icon={MailCheck}
              title={`${lead.name} - ${lead.company}`}
              subtitle={`${lead.email} - ${lead.interest}${lead.role ? ` - ${lead.role}` : ""}`}
              meta={`${lead.status} - ${timeAgo(lead.createdAt)}`}
              body={lead.message}
            >
              <AdminQueryReplyForm kind="contact" id={lead.id} to={lead.email} defaultSubject={`Re: Your SoterAI enquiry`} />
            </QueryCard>
          )) : <p className="text-sm text-slate-500">No contact queries yet.</p>}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <Rocket size={18} className="text-cyan" />
          <h2 className="text-lg font-semibold">Enterprise pilot requests</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {pilots.length ? pilots.map((pilot) => (
            <QueryCard
              key={pilot.id}
              icon={Rocket}
              title={`${pilot.companyName} - ${pilot.contactName}`}
              subtitle={`${pilot.contactEmail} - ${pilot.chatbotType} - ${pilot.deploymentPreference}`}
              meta={`${pilot.status} - ${timeAgo(pilot.createdAt)}`}
              body={`${pilot.useCase}\n\n${pilot.securityRequirements}`}
            >
              <AdminQueryReplyForm kind="pilot" id={pilot.id} to={pilot.contactEmail} defaultSubject={`Re: SoterAI enterprise pilot for ${pilot.companyName}`} />
            </QueryCard>
          )) : <p className="text-sm text-slate-500">No pilot requests yet.</p>}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <Ticket size={18} className="text-cyan" />
          <h2 className="text-lg font-semibold">Support tickets</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {tickets.length ? tickets.map((ticket) => (
            <QueryCard
              key={ticket.id}
              icon={Ticket}
              title={`${ticket.ticketNumber} - ${ticket.subject}`}
              subtitle={`${ticket.organization.name} - ${ticket.createdBy.email} - ${ticket.category} - ${ticket.priority}`}
              meta={`${ticket.status} - ${timeAgo(ticket.updatedAt)}`}
              body={ticket.messages[0]?.body ?? ticket.redactedContext ?? "No public message."}
            >
              <AdminQueryReplyForm kind="support" id={ticket.id} to={ticket.createdBy.email} defaultSubject={`Re: ${ticket.ticketNumber} - ${ticket.subject}`} />
            </QueryCard>
          )) : <p className="text-sm text-slate-500">No support tickets yet.</p>}
        </div>
      </section>
    </div>
  );
}
