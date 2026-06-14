import Link from "next/link";
import { Building2, FolderKanban, Plus, ShieldCheck, Users } from "lucide-react";
import { listClients } from "@/lib/agency";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgencyOverviewPage() {
  const { agency, clients } = await listClients();
  const projectIds = clients.flatMap((client) => client.projects.map((project) => project.id));
  const [requests, blocked] = await Promise.all([
    projectIds.length ? db.guardLog.count({ where: { projectId: { in: projectIds } } }) : 0,
    projectIds.length ? db.guardLog.count({ where: { projectId: { in: projectIds }, action: "BLOCK" } }) : 0,
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agency control</p>
          <h1 className="mt-2 text-3xl font-bold">{agency.name}</h1>
          <p className="mt-2 text-slate-400">Manage clients, projects, branding, and reports from one workspace.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/agency/clients/new" className="button-primary gap-2"><Plus size={18} /> Add client</Link>
          <Link href="/dashboard/agency/settings" className="button-secondary">Branding</Link>
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5"><div className="flex items-center gap-3"><Users className="text-cyan" /><p className="text-sm text-slate-500">Clients</p></div><p className="mt-3 text-3xl font-bold">{clients.length}</p></div>
        <div className="card p-5"><div className="flex items-center gap-3"><FolderKanban className="text-cyan" /><p className="text-sm text-slate-500">Projects</p></div><p className="mt-3 text-3xl font-bold">{projectIds.length}</p></div>
        <div className="card p-5"><div className="flex items-center gap-3"><Building2 className="text-cyan" /><p className="text-sm text-slate-500">Requests scanned</p></div><p className="mt-3 text-3xl font-bold">{requests}</p></div>
        <div className="card p-5"><div className="flex items-center gap-3"><ShieldCheck className="text-cyan" /><p className="text-sm text-slate-500">Blocked</p></div><p className="mt-3 text-3xl font-bold">{blocked}</p></div>
      </div>

      <h2 className="mt-9 text-lg font-semibold">Clients</h2>
      {clients.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {clients.map((client) => (
            <Link key={client.id} href={`/dashboard/agency/clients/${client.id}`} className="card block p-5 transition hover:border-cyan/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{client.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{client.contactEmail ?? "No contact email"}</p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">{client._count.projects} projects</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {client.projects.slice(0, 4).map((project) => (
                  <span key={project.id} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">{project.name}</span>
                ))}
                {client.projects.length > 4 && <span className="text-xs text-slate-500">+{client.projects.length - 4}</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card mt-4 p-10 text-center">
          <Users className="mx-auto text-slate-700" size={42} />
          <p className="mt-4 font-semibold">No clients yet</p>
          <p className="mt-2 text-sm text-slate-500">Add a client to issue scoped projects, keys, badges, and reports.</p>
          <Link href="/dashboard/agency/clients/new" className="button-primary mt-5 inline-flex gap-2"><Plus size={16} /> Add first client</Link>
        </div>
      )}
    </div>
  );
}
