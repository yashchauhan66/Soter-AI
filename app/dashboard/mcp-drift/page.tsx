import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type ServerRow = { id: string; serverName: string; status: string; trustLevel: string; updatedAt: Date };
type DriftRow = { id: string; serverId: string; toolName: string; driftType: string; riskBefore: string; riskAfter: string; summary: string; recommendation: string; status: string; createdAt: Date };

const RISK_TONE: Record<string, string> = { LOW: "text-emerald-300", MEDIUM: "text-amber-300", HIGH: "text-orange-300", CRITICAL: "text-red-300" };
const DRIFT_TONE: Record<string, string> = {
  PROMPT_INJECTION_DETECTED: "bg-red-400/10 text-red-300",
  CAPABILITY_ADDED: "bg-orange-400/10 text-orange-300",
  RISK_INCREASED: "bg-red-400/10 text-red-300",
  ENDPOINT_CHANGED: "bg-yellow-400/10 text-yellow-300",
  SCHEMA_CHANGED: "bg-blue-400/10 text-blue-300",
  DESCRIPTION_CHANGED: "bg-blue-400/10 text-blue-300",
  CAPABILITY_REMOVED: "bg-slate-700 text-slate-300",
};

export default async function McpDriftPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const [servers, drifts] = await Promise.all([
    safeRows<ServerRow>`SELECT "id", "serverName", "status", "trustLevel", "updatedAt" FROM "McpServerRegistry" WHERE "projectId" = ${project.id} ORDER BY "updatedAt" DESC LIMIT 100`,
    safeRows<DriftRow>`SELECT "id", "serverId", "toolName", "driftType", "riskBefore", "riskAfter", "summary", "recommendation", "status", "createdAt" FROM "McpToolDrift" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`,
  ]);
  const serverName = new Map(servers.map((s) => [s.id, s.serverName]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">MCP tool drift</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Detect when MCP server tools change in a risky way over time: new dangerous capabilities, prompt injection in descriptions, schema changes, or endpoint changes.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
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
              <span className={`rounded px-2 py-1 text-xs font-medium ${server.status === "QUARANTINED" ? "bg-red-400/10 text-red-300" : server.status === "DISABLED" ? "bg-slate-700 text-slate-400" : "bg-emerald-400/10 text-emerald-300"}`}>{server.status}</span>
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
                <td className="py-3"><span className={`rounded px-2 py-1 text-xs font-medium ${DRIFT_TONE[drift.driftType] ?? "bg-slate-700 text-slate-300"}`}>{drift.driftType}</span></td>
                <td className="font-mono text-xs">{drift.toolName}</td>
                <td>{serverName.get(drift.serverId) ?? drift.serverId.slice(0, 8)}</td>
                <td><span className={RISK_TONE[drift.riskBefore]}>{drift.riskBefore}</span> → <span className={`font-semibold ${RISK_TONE[drift.riskAfter]}`}>{drift.riskAfter}</span></td>
                <td className="max-w-[280px] truncate text-slate-400">{drift.recommendation}</td>
                <td>{drift.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {drifts.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={6}>No drift detected yet. Snapshot tools repeatedly to track drift.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Copy-paste integration</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{`import { createCybersecurityGuardClient } from "@cybersecurityguard/guard";

const guard = createCybersecurityGuardClient({ apiKey: process.env.CYBERSECURITYGUARD_API_KEY! });

await guard.registerMcpServer({ serverName: "filesystem-mcp", trustLevel: "INTERNAL" });

const snapshot = await guard.snapshotMcpTools({
  serverName: "filesystem-mcp",
  tools: mcpClient.listTools()
});

if (snapshot.drifts.some((d) => d.riskAfter === "CRITICAL")) {
  // quarantine the server / require approval
}`}</pre>
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
