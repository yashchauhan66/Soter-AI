import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, RiskLevel } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type ServerRow = { id: string; serverName: string; status: string; trustLevel: string; updatedAt: Date };
type DriftRow = { id: string; serverId: string; toolName: string; driftType: string; riskBefore: string; riskAfter: string; summary: string; recommendation: string; status: string; createdAt: Date };

export default async function McpDriftPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const [servers, drifts] = await Promise.all([
    safeRows<ServerRow>`SELECT "id", "serverName", "status", "trustLevel", "updatedAt" FROM "McpServerRegistry" WHERE "projectId" = ${project.id} ORDER BY "updatedAt" DESC LIMIT 100`,
    safeRows<DriftRow>`SELECT "id", "serverId", "toolName", "driftType", "riskBefore", "riskAfter", "summary", "recommendation", "status", "createdAt" FROM "McpToolDrift" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`,
  ]);
  const serverName = new Map(servers.map((s) => [s.id, s.serverName]));
  const criticalDrifts = drifts.filter((d) => d.riskAfter === "CRITICAL" || d.riskAfter === "HIGH").length;
  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="MCP tool drift"
        description="Detect when MCP server tools change in a risky way over time: new dangerous capabilities, prompt injection in descriptions, schema changes, or endpoint changes."
        useCase="MCP (Model Context Protocol) servers expose tools to AI agents. Over time, these tools can silently change — a file-read tool could gain delete capability, or a harmless description could be replaced with a prompt injection payload. Without drift detection, these changes go unnoticed until an incident occurs."
        howItWorks={[
          { heading: "Register MCP servers", body: "Register each MCP server with a trust level. The system tracks the server's identity and baseline tool signatures." },
          { heading: "Snapshot tools regularly", body: "Periodically snapshot the tools exposed by each MCP server. Each snapshot captures tool names, schemas, descriptions, and risk assessments." },
          { heading: "Detect drift", body: "When a new snapshot differs from the previous baseline, drift is detected. The system categorizes the change — new capabilities, description changes, schema changes, or endpoint changes — and re-assesses risk." },
          { heading: "Alert and quarantine", body: "Risky drifts trigger alerts. Servers with critical drifts can be automatically quarantined to prevent further tool access until reviewed." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

await soter.registerMcpServer({ serverName: "filesystem-mcp", trustLevel: "INTERNAL" });

const snapshot = await soter.snapshotMcpTools({
  serverName: "filesystem-mcp",
  tools: mcpClient.listTools()
});

if (snapshot.drifts.some((d) => d.riskAfter === "CRITICAL")) {
  // quarantine the server / require approval
}`}
        callout="MCP drift detection is based on periodic snapshots — it detects changes between snapshots, not real-time attacks. For real-time protection, combine with agent intent guard and tool-chain detection."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="MCP servers" value={servers.length} tone="gray" />
        <MetricCard label="Critical drifts" value={criticalDrifts} tone="red" />
        <MetricCard label="Total drifts" value={drifts.length} tone="yellow" />
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-semibold">MCP servers</h2>
        <div className="mt-4 grid gap-2">
          {servers.map((server) => (
            <div className="grid gap-1 rounded-lg border border-slate-800 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center" key={server.id}>
              <div>
                <p className="font-semibold">{server.serverName}</p>
                <p className="text-xs text-slate-500">trust {server.trustLevel} · updated {server.updatedAt.toLocaleString()}</p>
              </div>
              <StatusBadge value={server.status} />
            </div>
          ))}
          {servers.length === 0 && <p className="text-sm text-slate-500">No MCP servers registered yet.</p>}
        </div>
      </section>

      <section className="card overflow-x-auto p-5">
        <h2 className="text-lg font-semibold">Drift history</h2>
        <table className="mt-4 w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Drift</th><th>Tool</th><th>Server</th><th>Before → After</th><th>Recommendation</th><th>When</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {drifts.map((drift) => (
              <tr key={drift.id}>
                <td className="py-3"><StatusBadge value={drift.driftType} /></td>
                <td className="font-mono text-xs">{drift.toolName}</td>
                <td>{serverName.get(drift.serverId) ?? drift.serverId.slice(0, 8)}</td>
                <td><RiskLevel level={drift.riskBefore} /> → <RiskLevel level={drift.riskAfter} /></td>
                <td className="max-w-[280px] truncate text-slate-400">{drift.recommendation}</td>
                <td>{drift.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {drifts.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={6}>No drift detected yet. Snapshot tools repeatedly to track drift.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
