import Link from "next/link";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/dashboard/PageHeader";
export const dynamic = "force-dynamic";
export default async function PartnerClientsPage() { const active = await getActiveOrganization(); const clients = active ? await db.client.findMany({ where: { agency: { organizationId: active.org.id } }, include: { _count: { select: { projects: true } } }, orderBy: { createdAt: "desc" } }) : []; return <div><div className="flex items-end justify-between"><div><PageHeader
        eyebrow="Partner clients"
        title="Client portfolio"
      /></div><Link href="/dashboard/agency/clients/new" className="button-primary">Add client</Link></div><div className="mt-7 divide-y divide-slate-800 border-y border-slate-800">{clients.map(client => <div className="flex justify-between py-4" key={client.id}><div><p className="font-semibold">{client.name}</p><p className="text-sm text-slate-300">{client.contactEmail ?? "No contact email"}</p></div><span>{client._count.projects} chatbots</span></div>)}</div></div>; }
