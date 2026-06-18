import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { id: string; agentName: string; agentType: string; status: string; createdAt: Date; endedAt: Date | null };

export default async function AgentFirewallSessionsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const sessions = await safeRows<Row>`SELECT "id", "agentName", "agentType", "status", "createdAt", "endedAt" FROM "AgentSession" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Agent firewall</p><h1 className="mt-2 text-3xl font-bold">Sessions</h1></div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <section className="card overflow-x-auto p-5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Agent</th><th>Type</th><th>Status</th><th>Started</th><th>Ended</th><th>Session</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {sessions.map((row) => <tr key={row.id}><td className="py-3 font-medium">{row.agentName}</td><td>{row.agentType}</td><td>{row.status}</td><td>{row.createdAt.toLocaleString()}</td><td>{row.endedAt?.toLocaleString() ?? "-"}</td><td className="font-mono text-xs">{row.id}</td></tr>)}
            {sessions.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={6}>No sessions yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
