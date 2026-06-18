import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SourceRow = { id: string; sourceType: string; sourceName: string | null; sourceTrustLevel: string; sensitivityLevel: string; createdAt: Date };
type FlowRow = { id: string; destinationType: string; destinationName: string | null; destinationTrustLevel: string; decision: string; riskLevel: string; reason: string; createdAt: Date };
type IncidentRow = { id: string; incidentType: string; riskLevel: string; summary: string; status: string; createdAt: Date };

const DECISION_TONE: Record<string, string> = {
  ALLOW: "bg-emerald-400/10 text-emerald-300",
  ASK_APPROVAL: "bg-yellow-400/10 text-yellow-300",
  REVIEW: "bg-blue-400/10 text-blue-300",
  REDACT: "bg-blue-400/10 text-blue-300",
  BLOCK: "bg-red-400/10 text-red-300",
};

const RISK_TONE: Record<string, string> = {
  LOW: "text-emerald-300", MEDIUM: "text-amber-300", HIGH: "text-orange-300", CRITICAL: "text-red-300",
};

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Context lineage firewall</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Track where AI data came from, where it is going, and whether the agent is allowed to move it. Blocked egress and cross-context leaks are logged as incidents.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Context sources" value={sources.length} tone="gray" />
        <Metric label="Blocked flows" value={blocked} tone="red" />
        <Metric label="Open incidents" value={incidents.filter((i) => i.status === "OPEN").length} tone="yellow" />
      </div>

      <section className="card overflow-x-auto p-5">
        <h2 className="text-lg font-semibold">Context flows</h2>
        <table className="mt-4 w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Decision</th><th>Risk</th><th>Destination</th><th>Trust</th><th>Reason</th><th>When</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {flows.map((flow) => (
              <tr key={flow.id}>
                <td className="py-3"><span className={`rounded px-2 py-1 text-xs font-medium ${DECISION_TONE[flow.decision] ?? "bg-slate-700 text-slate-300"}`}>{flow.decision}</span></td>
                <td className={`font-semibold ${RISK_TONE[flow.riskLevel] ?? "text-slate-400"}`}>{flow.riskLevel}</td>
                <td className="font-mono text-xs">{flow.destinationType}{flow.destinationName ? ` · ${flow.destinationName}` : ""}</td>
                <td>{flow.destinationTrustLevel}</td>
                <td className="max-w-[280px] truncate text-slate-400">{flow.reason}</td>
                <td>{flow.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {flows.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={6}>No context flows checked yet.</td></tr>}
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
                </div>
                <span className={`text-xs font-semibold ${src.sensitivityLevel === "PUBLIC" ? "text-emerald-300" : src.sensitivityLevel === "INTERNAL" ? "text-amber-300" : "text-red-300"}`}>{src.sensitivityLevel}</span>
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
                  <span className={`text-xs font-semibold ${RISK_TONE[incident.riskLevel] ?? "text-slate-400"}`}>{incident.riskLevel}</span>
                </div>
                <p className="mt-1 text-slate-400">{incident.summary}</p>
                <p className="mt-1 text-xs text-slate-500">{incident.status} · {incident.createdAt.toLocaleString()}</p>
              </div>
            ))}
            {incidents.length === 0 && <p className="text-sm text-slate-500">No lineage incidents recorded.</p>}
          </div>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Copy-paste integration</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{`import { createCybersecurityGuardClient } from "@cybersecurityguard/guard";

const guard = createCybersecurityGuardClient({
  apiKey: process.env.CYBERSECURITYGUARD_API_KEY!,
  baseUrl: process.env.CYBERSECURITYGUARD_BASE_URL
});

const source = await guard.registerContextSource({
  sourceType: "RAG_DOCUMENT",
  sourceName: "customer-contract.pdf",
  sourceTrustLevel: "INTERNAL",
  sensitivityLevel: "CONFIDENTIAL",
  content: documentText
});

const flow = await guard.checkContextFlow({
  sourceIds: [source.sourceId],
  destinationType: "EXTERNAL_API",
  destinationName: "unknown-tool",
  destinationTrustLevel: "UNKNOWN",
  action: "send_context",
  content: selectedChunk
});

if (flow.decision === "BLOCK") throw new Error(flow.reason);`}</pre>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "green" | "yellow" | "red" | "gray" }) {
  const tones = { green: "text-emerald-300", yellow: "text-yellow-300", red: "text-red-300", gray: "text-slate-300" };
  return (
    <section className="card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </section>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
