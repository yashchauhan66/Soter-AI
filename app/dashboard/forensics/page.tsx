import { FileSearch, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { getForensicSummary } from "@/lib/forensics";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

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
    NONE: "bg-slate-600/30 text-slate-200",
  };

  return (
    <div className="space-y-7">
      <FeatureGuide
        eyebrow="Investigation"
        title="AI Incident Forensics"
        description="Investigate AI security incidents, reconstruct timelines, collect evidence, and generate forensic reports. Track incidents from discovery through identification, monitoring, and resolution."
        useCase="When something goes wrong — a prompt-injection attack, a data leak, a rogue agent action — you need a structured record, not scattered notes. Forensics gives each incident a lifecycle, ties affected components together, and produces a report you can hand to auditors, customers, or regulators."
        howItWorks={[
          { heading: "Open an incident", body: "Create an incident with a title, summary, impact level (NONE to CRITICAL), and the affected components when you detect suspicious AI activity or a policy violation." },
          { heading: "Work the lifecycle", body: "Move the incident through INVESTIGATING, IDENTIFIED, MONITORING, and RESOLVED as you learn more. Open incident count is tracked at a glance." },
          { heading: "Collect evidence", body: "Reconstruct the timeline and gather the evidence tied to the incident and its affected components for a complete picture." },
          { heading: "Generate a report", body: "Produce a forensic report from an incident to document findings and share an auditable account of what happened and how it was handled." },
        ]}
        integrationCode={`// Open an incident when suspicious AI activity is detected
const res = await fetch("https://soterai.in/api/forensics", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.SOTER_API_KEY}\`,
  },
  body: JSON.stringify({
    projectId: "your-project-id",
    title: "Possible prompt-injection via RAG document",
    summary: "Agent attempted to exfiltrate a confidential contract.",
    impact: "MAJOR",
    affectedComponents: ["rag-collection-42", "agent-session-7"],
  }),
});`}
        callout="Incidents and reports are records you create and maintain. Forensics documents and organizes an investigation; it does not automatically detect incidents on its own."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-5">
          <AlertTriangle className="mb-2 text-rose-300" size={20} />
          <p className="text-sm text-slate-200">Open incidents</p>
          <p className="mt-1 text-2xl font-bold">{openIncidentCount}</p>
        </div>
        <div className="card p-5">
          <FileSearch className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-200">Total incidents</p>
          <p className="mt-1 text-2xl font-bold">{incidents.length}</p>
        </div>
        <div className="card p-5">
          <Clock className="mb-2 text-cyan" size={20} />
          <p className="text-sm text-slate-200">Forensic reports</p>
          <p className="mt-1 text-2xl font-bold">{reports.length}</p>
        </div>
        <div className="card p-5">
          <CheckCircle2 className="mb-2 text-emerald-300" size={20} />
          <p className="text-sm text-slate-200">Resolved</p>
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
              <p className="text-sm text-slate-300">
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
                <p className="mt-0.5 text-xs text-slate-300">
                  {incident.startedAt.toLocaleDateString()} ·{" "}
                  {incident.affectedComponents.length} component(s)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    statusColors[incident.status] ?? "bg-slate-600/30 text-slate-200"
                  }`}
                >
                  {incident.status}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    impactColors[incident.impact] ?? "bg-slate-600/30 text-slate-200"
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
              <p className="text-sm text-slate-300">
                No forensic reports generated yet. Generate a report from an incident.
              </p>
            </div>
          )}
          {reports.map((report) => (
            <div className="card flex items-center justify-between p-4" key={report.id}>
              <div>
                <p className="font-medium">{report.title}</p>
                <p className="text-xs text-slate-300">
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
        <p className="mt-1 text-sm text-slate-200">
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
