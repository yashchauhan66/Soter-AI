import Link from "next/link";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SessionRow = { id: string; agentName: string; agentType: string; status: string; createdAt: Date };
type ReplayRow = { sessionId: string; summary: string; riskLevel: string; createdAt: Date };

const RISK_TONE: Record<string, string> = {
  LOW: "text-emerald-300",
  MEDIUM: "text-amber-300",
  HIGH: "text-orange-300",
  CRITICAL: "text-red-300",
};

export default async function AgentReplayPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const [sessions, replays] = await Promise.all([
    safeRows<SessionRow>`SELECT "id", "agentName", "agentType", "status", "createdAt" FROM "AgentSession" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`,
    safeRows<ReplayRow>`SELECT DISTINCT ON ("sessionId") "sessionId", "summary", "riskLevel", "createdAt" FROM "AgentReplay" WHERE "projectId" = ${project.id} ORDER BY "sessionId", "createdAt" DESC`,
  ]);
  const replayBySession = new Map(replays.map((replay) => [replay.sessionId, replay]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Agent firewall</p><h1 className="mt-2 text-3xl font-bold">Replay &amp; forensics</h1></div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <p className="text-sm text-slate-500">Open a session to replay its full timeline: input guard, planned actions, firewall decisions, approvals, memory events, and canary leaks. Fetch the JSON timeline from <span className="font-mono text-xs">GET /api/agent/replay/:sessionId</span>.</p>
      <section className="card overflow-x-auto p-5">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Risk</th><th>Agent</th><th>Type</th><th>Summary</th><th>Started</th><th>Session</th><th>Export</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {sessions.map((row) => {
              const replay = replayBySession.get(row.id);
              return (
                <tr key={row.id}>
                  <td className={`py-3 font-semibold ${RISK_TONE[replay?.riskLevel ?? ""] ?? "text-slate-400"}`}>{replay?.riskLevel ?? "-"}</td>
                  <td className="font-medium">{row.agentName}</td>
                  <td>{row.agentType}</td>
                  <td className="max-w-[320px] text-slate-300">{replay?.summary ?? "No replay generated yet."}</td>
                  <td>{row.createdAt.toLocaleString()}</td>
                  <td><Link className="font-mono text-xs text-blue-300 hover:underline" href={`/api/agent/replay/${row.id}`}>{row.id.slice(0, 12)}…</Link></td>
                  <td><Link className="text-xs text-slate-400 hover:text-white hover:underline" href={`/api/agent/replay/${row.id}?format=pdf`}>PDF</Link></td>
                </tr>
              );
            })}
            {sessions.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={7}>No sessions to replay yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
