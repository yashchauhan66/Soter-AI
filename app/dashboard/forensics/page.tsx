import { FileSearch, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { getForensicSummary } from "@/lib/forensics";

export const dynamic = "force-dynamic";

export default async function ForensicsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, _projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  await requireProjectPermission(project.id, "forensics:read");

  const summary = await getForensicSummary(project.organizationId ?? "");
  const { incidents, reports, openIncidentCount } = summary;

  const statusColors: Record<string, string> = {
    INVESTIGATING: "bg-rose-500/15 text-rose-300",
    IDENTIFIED: "bg-amber-500/15 text-amber-300",
    MONITORING: "bg-cyan-500/15 text-cyan-300",
    RESOLVED: "bg-emerald-500/15 text-emerald-300",
  };

  const impactColors: Record<string, string> = {
    CRITICAL: "bg-rose-500/15 text-rose-300",
    MAJOR: "bg-amber-500/15 text-amber-300",
    MINOR: "bg-cyan-500/15 text-cyan-300",
    NONE: "bg-slate-600/30 text-slate-400",
  };

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">Investigation</p>
        <h1 className="mt-2 text-3xl font-bold">AI Incident Forensics</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Investigate AI security incidents, reconstruct timelines, collect evidence,
          and generate forensic reports. Track incidents from discovery through
          identification, monitoring, and resolution.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-5">
          <AlertTriangle className="mb-2 text-rose-300" size={20} />
          <p className="text-sm text-slate-400">Open incidents</p>
          <p className="mt-1 text-2xl font-bold">{openIncidentCount}</p>
        </div>
        <div className="card p-5">
          <FileSearch className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Total incidents</p>
          <p className="mt-1 text-2xl font-bold">{incidents.length}</p>
        </div>
        <div className="card p-5">
          <Clock className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-400">Forensic reports</p>
          <p className="mt-1 text-2xl font-bold">{reports.length}</p>
        </div>
        <div className="card p-5">
          <CheckCircle2 className="mb-2 text-emerald-300" size={20} />
          <p className="text-sm text-slate-400">Resolved</p>
          <p className="mt-1 text-2xl font-bold">
            {incidents.filter((i) => i.status === "RESOLVED").length}
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Incidents</h2>
        <div className="space-y-3">
          {incidents.length === 0 && (
            <div className="card p-6 text-center">
              <p className="text-sm text-slate-500">
                No incidents recorded yet. Create an incident to start an investigation.
              </p>
            </div>
          )}
          {incidents.map((incident) => (
            <Link
              className="card flex items-center justify-between p-4 transition hover:border-slate-600"
              href={`/dashboard/forensics/${incident.id}?project=${project.id}`}
              key={incident.id}
            >
              <div className="flex-1">
                <p className="font-medium">{incident.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {incident.startedAt.toLocaleDateString()} ·{" "}
                  {incident.affectedComponents.length} component(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    statusColors[incident.status] ?? "bg-slate-600/30 text-slate-400"
                  }`}
                >
                  {incident.status}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    impactColors[incident.impact] ?? "bg-slate-600/30 text-slate-400"
                  }`}
                >
                  {incident.impact}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Forensic reports</h2>
        <div className="space-y-3">
          {reports.length === 0 && (
            <div className="card p-6 text-center">
              <p className="text-sm text-slate-500">
                No forensic reports generated yet. Generate a report from an incident.
              </p>
            </div>
          )}
          {reports.map((report) => (
            <div className="card flex items-center justify-between p-4" key={report.id}>
              <div>
                <p className="font-medium">{report.title}</p>
                <p className="text-xs text-slate-500">
                  {report.incident.title} · {report.reportType} · {report.status}
                </p>
              </div>
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                {report.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="card p-5">
        <h2 className="text-lg font-semibold">Create an incident</h2>
        <p className="mt-1 text-sm text-slate-400">
          Start an incident investigation when you detect suspicious AI activity, a
          security breach, or a policy violation. The forensics engine will help you
          reconstruct the timeline and collect evidence.
        </p>
        <Link
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan/90"
          href={`/dashboard/forensics/new?project=${project.id}`}
        >
          <FileSearch size={16} />
          New incident
        </Link>
      </div>
    </div>
  );
}
