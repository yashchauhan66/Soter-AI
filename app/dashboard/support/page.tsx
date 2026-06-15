import Link from "next/link";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUPPORT_PAGE_SIZE = 25;

function parseCursorDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const params = await searchParams;
  const active = await getActiveOrganization();
  const cursor = parseCursorDate(params.cursor);
  const rows = active
    ? await db.supportTicket.findMany({
        where: { organizationId: active.org.id, ...(cursor ? { updatedAt: { lt: cursor } } : {}) },
        orderBy: { updatedAt: "desc" },
        take: SUPPORT_PAGE_SIZE + 1,
        select: {
          id: true,
          subject: true,
          ticketNumber: true,
          category: true,
          status: true,
          priority: true,
          updatedAt: true,
          messages: {
            where: { internal: false },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true },
          },
        },
      })
    : [];
  const hasMore = rows.length > SUPPORT_PAGE_SIZE;
  const tickets = rows.slice(0, SUPPORT_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Customer support</p>
          <h1 className="mt-2 text-3xl font-bold">Support tickets</h1>
        </div>
        <div className="flex items-center gap-4">
          {hasMore && (
            <Link className="text-sm font-semibold text-cyan" href={`/dashboard/support?cursor=${tickets.at(-1)?.updatedAt.toISOString()}`}>
              Next tickets
            </Link>
          )}
          <Link className="button-primary" href="/dashboard/support/new">
            New ticket
          </Link>
        </div>
      </div>
      <div className="mt-7 divide-y divide-slate-800 border-y border-slate-800">
        {tickets.length ? (
          tickets.map((ticket) => (
            <article className="grid gap-2 py-5 sm:grid-cols-[1fr_auto]" key={ticket.id}>
              <div>
                <p className="font-semibold">{ticket.subject}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {ticket.ticketNumber} - {ticket.category} - {ticket.messages[0]?.body ?? "No public reply yet"}
                </p>
              </div>
              <div className="text-sm">
                <span className="text-cyan">{ticket.status}</span>
                <p className="mt-1 text-slate-500">{ticket.priority}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="py-8 text-slate-500">No support tickets yet.</p>
        )}
      </div>
    </div>
  );
}
