import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

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

const DECISION_TONE: Record<string, string> = {
  SAFE_TO_EXECUTE: "bg-emerald-400/10 text-emerald-300",
  REQUIRE_APPROVAL: "bg-yellow-400/10 text-yellow-300",
  REVIEW: "bg-blue-400/10 text-blue-300",
  BLOCK: "bg-red-400/10 text-red-300",
};

const RISK_TONE: Record<string, string> = {
  LOW: "text-emerald-300",
  MEDIUM: "text-amber-300",
  HIGH: "text-orange-300",
  CRITICAL: "text-red-300",
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
        <Metric label="Simulations" value={dryRuns.length} tone="gray" />
        <Metric label="Blocked" value={blocked} tone="red" />
        <Metric label="Approval holds" value={approvals} tone="yellow" />
        <Metric label="Review" value={review} tone="blue" />
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
                <td className="py-3"><Badge value={run.decision} /></td>
                <td className={`font-semibold ${RISK_TONE[run.riskLevel] ?? "text-slate-400"}`}>{run.riskLevel}</td>
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
                  <Badge value={run.decision} />
                  <span className={`text-xs font-bold ${RISK_TONE[run.riskLevel] ?? "text-slate-400"}`}>{run.riskLevel}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Payload title="Simulated payload" value={run.simulatedPayloadRedacted} />
                <Payload title="Effects" value={formatEffects(run.simulatedEffectsJson)} />
              </div>
            </div>
          ))}
          {dryRuns.length === 0 && <p className="text-sm text-slate-500">No predicted effects available yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "yellow" | "red" | "gray" | "blue" }) {
  const tones = { yellow: "text-yellow-300", red: "text-red-300", gray: "text-slate-300", blue: "text-blue-300" };
  return (
    <section className="card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </section>
  );
}

function Badge({ value }: { value: string }) {
  return <span className={`rounded px-2 py-1 text-xs font-medium ${DECISION_TONE[value] ?? "bg-slate-700 text-slate-300"}`}>{value}</span>;
}

function Payload({ title, value }: { title: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-950/70 p-2 text-xs text-slate-300">{value ?? "No payload supplied."}</pre>
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
