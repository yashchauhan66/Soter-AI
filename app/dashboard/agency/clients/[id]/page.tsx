import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderKanban, ShieldCheck } from "lucide-react";
import { getClientWithStats } from "@/lib/agency";
import { ClientProjectActions } from "@/components/dashboard/ClientProjectActions";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getClientWithStats(id);
  if (!data) notFound();
  const { client, totals } = data;

  return (
    <div>
      <Link href="/dashboard/agency/clients" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Back to clients</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Client</p>
          <h1 className="mt-2 text-3xl font-bold">{client.name}</h1>
          <p className="mt-2 text-slate-400">{client.contactEmail ?? "No contact email"}</p>
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5"><p className="text-sm text-slate-500">Requests scanned</p><p className="mt-2 text-3xl font-bold">{totals.requests}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Blocked</p><p className="mt-2 text-3xl font-bold">{totals.blocked}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Redacted</p><p className="mt-2 text-3xl font-bold">{totals.redacted}</p></div>
        <div className="card p-5"><p className="text-sm text-slate-500">Average risk</p><p className="mt-2 text-3xl font-bold">{totals.avgRisk}</p></div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Projects</h2>
        <Link href={`/dashboard/projects/new?clientId=${client.id}`} className="button-secondary !py-2 text-sm gap-2"><FolderKanban size={16} /> Add project</Link>
      </div>

      {client.projects.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {client.projects.map((project) => (
            <article key={project.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{project.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{project.plan} plan</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${project.badgeEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                  <ShieldCheck size={12} className="mr-1 inline" /> badge {project.badgeEnabled ? "on" : "off"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Link href={`/dashboard/logs?project=${project.id}`} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-cyan/50">Logs</Link>
                <Link href={`/dashboard/reports?project=${project.id}`} className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-cyan/50">Report</Link>
                <Link href={`/security-status/${project.badgeSlug}`} target="_blank" className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-cyan/50">Public status</Link>
                <ClientProjectActions projectId={project.id} badgeEnabled={project.badgeEnabled} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card mt-4 p-10 text-center text-slate-500">
          <p>No projects under this client.</p>
          <Link href={`/dashboard/projects/new?clientId=${client.id}`} className="button-primary mt-5 inline-flex gap-2">Add first project</Link>
        </div>
      )}
    </div>
  );
}
