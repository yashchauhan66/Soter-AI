import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, EmptyRow, RiskLevel } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type SourceRow = { id: string; sourceType: string; sourceName: string | null; sourceTrustLevel: string; sensitivityLevel: string; createdAt: Date };
type FlowRow = { id: string; destinationType: string; destinationName: string | null; destinationTrustLevel: string; decision: string; riskLevel: string; reason: string; createdAt: Date };
type IncidentRow = { id: string; incidentType: string; riskLevel: string; summary: string; status: string; createdAt: Date };



export default async function LineagePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const [sources, flows, incidents] = await Promise.all([
    safeRows<SourceRow>`SELECT "id", "sourceType", "sourceName", "sourceTrustLevel", "sensitivityLevel", "createdAt" FROM "ContextSource" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 50`,
    safeRows<FlowRow>`SELECT "id", "destinationType", "destinationName", "destinationTrustLevel", "decision", "riskLevel", "reason", "createdAt" FROM "ContextFlow" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 50`,
    safeRows<IncidentRow>`SELECT "id", "incidentType", "riskLevel", "summary", "status", "createdAt" FROM "LineageIncident" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 50`,
  ]);
  const blocked = flows.filter((flow) => flow.decision === "BLOCK").length;
  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Context lineage firewall"
        description="Track where AI data came from, where it is going, and whether the agent is allowed to move it. Blocked egress and cross-context leaks are logged as incidents."
        useCase="AI agents access data from multiple sources (RAG documents, emails, databases, user input). Without lineage tracking, an agent could read a confidential contract from one source and send it to a public API — a data leak that individual input/output guards wouldn't catch."
        howItWorks={[
          { heading: "Register context sources", body: 'Use the SDK to register each data source with a trust level (PUBLIC, INTERNAL, CONFIDENTIAL) and sensitivity level. Each source gets a unique fingerprint.' },
          { heading: "Check every flow", body: "When an agent transfers data between sources (e.g., reading from RAG and sending to an API), the lineage firewall checks whether the destination trust level is compatible with the source sensitivity." },
          { heading: "Block or allow", body: "Transfers from sensitive sources to untrusted destinations are blocked. Flow decisions are logged with reasons for audit." },
          { heading: "Incident tracking", body: "Unauthorized flow attempts are recorded as lineage incidents with risk levels for review and escalation." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

const source = await soter.registerContextSource({
  sourceType: "RAG_DOCUMENT",
  sourceName: "customer-contract.pdf",
  sourceTrustLevel: "INTERNAL",
  sensitivityLevel: "CONFIDENTIAL",
  content: documentText
});

const flow = await soter.checkContextFlow({
  sourceIds: [source.sourceId],
  destinationType: "EXTERNAL_API",
  destinationName: "unknown-tool",
  destinationTrustLevel: "UNKNOWN",
  action: "send_context",
  content: selectedChunk
});

if (flow.decision === "BLOCK") throw new Error(flow.reason);`}
        callout="Lineage tracking requires SDK integration to register sources and check flows. Without explicit source registration, all data is treated as PUBLIC."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Context sources" value={sources.length} tone="gray" />
        <MetricCard label="Blocked flows" value={blocked} tone="red" />
        <MetricCard label="Open incidents" value={incidents.filter((i) => i.status === "OPEN").length} tone="yellow" />
      </div>

      <section className="card overflow-x-auto p-5">
        <h2 className="text-lg font-semibold">Context flows</h2>
        <table className="mt-4 w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Decision</th><th>Risk</th><th>Destination</th><th>Trust</th><th>Reason</th><th>When</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {flows.map((flow) => (
              <tr key={flow.id}>
                <td className="py-3"><StatusBadge value={flow.decision} /></td>
                <td className="font-semibold"><RiskLevel level={flow.riskLevel} /></td>
                <td className="font-mono text-xs">{flow.destinationType}{flow.destinationName ? ` · ${flow.destinationName}` : ""}</td>
                <td>{flow.destinationTrustLevel}</td>
                <td className="max-w-[280px] truncate text-slate-400">{flow.reason}</td>
                <td>{flow.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            <EmptyRow colSpan={6} message="No context flows checked yet." />
          </tbody>
        </table>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-lg font-semibold">Context sources</h2>
          <div className="mt-4 grid gap-2">
            {sources.map((src) => (
              <div className="grid gap-1 rounded-lg border border-slate-800 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center" key={src.id}>
                <div>
                  <p className="font-semibold">{src.sourceName ?? src.sourceType}</p>
                  <p className="text-xs text-slate-500">{src.sourceType} · trust {src.sourceTrustLevel}</p>
                </div>                  <RiskLevel level={src.sensitivityLevel} />
              </div>
            ))}
            {sources.length === 0 && <p className="text-sm text-slate-500">Register sources via the SDK to populate lineage.</p>}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-semibold">Lineage incidents</h2>
          <div className="mt-4 space-y-3">
            {incidents.map((incident) => (
              <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm" key={incident.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-red-200">{incident.incidentType}</p>
                  <RiskLevel level={incident.riskLevel} />
                </div>
                <p className="mt-1 text-slate-400">{incident.summary}</p>
                <p className="mt-1 text-xs text-slate-500">{incident.status} · {incident.createdAt.toLocaleString()}</p>
              </div>
            ))}
            {incidents.length === 0 && <p className="text-sm text-slate-500">No lineage incidents recorded.</p>}
          </div>
        </section>
      </div>


    </div>
  );
}
async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
