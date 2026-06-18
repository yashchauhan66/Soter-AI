import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { id: string; serverName: string; toolName: string; riskLevel: string; detectedCapabilitiesJson: unknown; riskReasonsJson: unknown; createdAt: Date };

export default async function McpScannerPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const rows = await safeRows<Row>`SELECT "id", "serverName", "toolName", "riskLevel", "detectedCapabilitiesJson", "riskReasonsJson", "createdAt" FROM "McpToolScan" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Agent firewall</p><h1 className="mt-2 text-3xl font-bold">MCP scanner</h1></div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <section className="card overflow-x-auto p-5">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Risk</th><th>Server</th><th>Tool</th><th>Capabilities</th><th>Reasons</th><th>Scanned</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => <tr key={row.id}><td className="py-3 font-semibold">{row.riskLevel}</td><td>{row.serverName}</td><td className="font-mono text-xs">{row.toolName}</td><td>{jsonList(row.detectedCapabilitiesJson)}</td><td>{jsonList(row.riskReasonsJson)}</td><td>{row.createdAt.toLocaleString()}</td></tr>)}
            {rows.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={6}>No MCP scans yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function jsonList(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "-";
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
