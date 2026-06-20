import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { MetricCard, StatusBadge, PayloadViewer, RiskLevel } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type DryRunRow = {
  id: string;
  sessionId: string;
  agentIdentityId: string | null;
  dryRunType: string;
  tool: string;
  action: string;
  target: string | null;
  simulatedPayloadRedacted: string | null;
  simulatedEffectsJson: unknown;
  riskLevel: string;
  decision: string;
  reason: string;
  createdAt: Date;
};


export default async function DryRunPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const dryRuns = await safeRows<DryRunRow>`
    SELECT "id", "sessionId", "agentIdentityId", "dryRunType", "tool", "action", "target",
      "simulatedPayloadRedacted", "simulatedEffectsJson", "riskLevel", "decision", "reason", "createdAt"
    FROM "AgentDryRun"
    WHERE "projectId" = ${project.id}
    ORDER BY "createdAt" DESC
    LIMIT 150
  `;

  const blocked = dryRuns.filter((run) => run.decision === "BLOCK").length;
  const approvals = dryRuns.filter((run) => run.decision === "REQUIRE_APPROVAL").length;
  const review = dryRuns.filter((run) => run.decision === "REVIEW").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Sandbox dry-run</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Simulate risky agent actions before execution and fail closed when the predicted effects are unsafe.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Simulations" value={dryRuns.length} tone="gray" />
        <MetricCard label="Blocked" value={blocked} tone="red" />
        <MetricCard label="Approval holds" value={approvals} tone="yellow" />
        <MetricCard label="Review" value={review} tone="blue" />
      </div>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent simulations</h2>
          <span className="text-xs font-medium text-slate-500">{dryRuns.length} recent</span>
        </div>
        <table className="mt-4 w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Decision</th>
              <th>Risk</th>
              <th>Type</th>
              <th>Tool</th>
              <th>Action</th>
              <th>Target</th>
              <th>Session</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {dryRuns.map((run) => (
              <tr key={run.id}>
                <td className="py-3"><StatusBadge value={run.decision} /></td>
                <td className="font-semibold"><RiskLevel level={run.riskLevel} /></td>
                <td>{run.dryRunType}</td>
                <td className="font-mono text-xs text-slate-400">{run.tool}</td>
                <td>{run.action}</td>
                <td className="max-w-[220px] truncate text-slate-400">{run.target ?? "-"}</td>
                <td className="font-mono text-xs text-slate-500">{run.sessionId}</td>
                <td>{run.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {dryRuns.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={8}>No dry-run simulations recorded yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Predicted effects</h2>
          <span className="text-xs font-medium text-slate-500">Latest 20</span>
        </div>
        <div className="mt-4 grid gap-3">
          {dryRuns.slice(0, 20).map((run) => (
            <div className="rounded-lg border border-slate-800 p-3 text-sm" key={run.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{run.tool} / {run.action}</p>
                  <p className="mt-1 max-w-3xl text-slate-400">{run.reason}</p>
                  <p className="mt-2 text-xs text-slate-500">Session {run.sessionId}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge value={run.decision} />
                  <RiskLevel level={run.riskLevel} />
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <PayloadViewer title="Simulated payload" value={run.simulatedPayloadRedacted} />
                <PayloadViewer title="Effects" value={formatEffects(run.simulatedEffectsJson)} />
              </div>
            </div>
          ))}
          {dryRuns.length === 0 && <p className="text-sm text-slate-500">No predicted effects available yet.</p>}
        </div>
      </section>
    </div>
  );
}

function formatEffects(value: unknown) {
  if (!value) return "No effects recorded.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Effects could not be formatted.";
  }
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}
