import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { MetricCard, StatusBadge, PayloadViewer, RiskLevel } from "@/components/dashboard/MetricCard";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

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
      <FeatureGuide
        eyebrow="Agent security"
        title="Sandbox dry-run"
        description="Simulate a risky agent action before it runs — sending email, writing or deleting files, running a terminal command, making a payment — and get a decision plus predicted effects, so you can fail closed when the outcome looks unsafe."
        useCase="Autonomous agents take real-world actions: they send emails, hit APIs, install packages, delete files, move money. A single bad tool call can cause irreversible damage. The dry-run sandbox lets you preview a proposed action first — it returns a risk level and a decision (safe to execute, require approval, review, or block) along with the predicted effects, so your agent can gate high-impact actions instead of blindly executing them."
        howItWorks={[
          { heading: "Describe the action", body: "Before executing, send the proposed tool call — its type (email, file write/delete, terminal, API call, payment, and so on), tool, action, target, and payload — to the simulate endpoint." },
          { heading: "Simulate the effects", body: "The sandbox evaluates the action against your policies and produces the predicted effects and findings without actually performing the action. Payloads are stored redacted." },
          { heading: "Return a decision", body: "You get back a decision — safe to execute, require approval, review, or block — plus a risk level and a plain-language reason your agent (or a human) can act on." },
          { heading: "Fail closed", body: "Gate execution on the decision: only proceed on safe-to-execute, route require-approval and review to a human, and block the unsafe ones outright." },
        ]}
        integrationCode={`import { simulateAgentAction } from "@soterai/core";

const options = { apiKey: process.env.SOTER_API_KEY };

const result = await simulateAgentAction(options, {
  sessionId: "agent-session-123",
  dryRunType: "FILE_DELETE",
  tool: "filesystem",
  action: "delete",
  target: "/var/data/customers.db",
  simulatedPayload: proposedPayload,
});

if (result.decision === "SAFE_TO_EXECUTE") {
  await runTheRealAction();
} else {
  // require approval / review / block — do NOT execute
  console.warn(result.decision, result.riskLevel, result.reason);
}`}
        callout="Dry-run is a pre-execution simulation, not an enforcement layer. It predicts effects and returns a decision — it does not itself stop your agent. Safety depends on your code honoring the returned decision and failing closed on anything other than SAFE_TO_EXECUTE."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Simulations" value={dryRuns.length} tone="gray" />
        <MetricCard label="Blocked" value={blocked} tone="red" />
        <MetricCard label="Approval holds" value={approvals} tone="yellow" />
        <MetricCard label="Review" value={review} tone="blue" />
      </div>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent simulations</h2>
          <span className="text-xs font-medium text-slate-300">{dryRuns.length} recent</span>
        </div>
        <table className="mt-4 w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-300">
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
                <td className="font-mono text-xs text-slate-200">{run.tool}</td>
                <td>{run.action}</td>
                <td className="max-w-[220px] truncate text-slate-200">{run.target ?? "-"}</td>
                <td className="font-mono text-xs text-slate-300">{run.sessionId}</td>
                <td>{run.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {dryRuns.length === 0 && <tr><td className="py-5 text-slate-300" colSpan={8}>No dry-run simulations recorded yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Predicted effects</h2>
          <span className="text-xs font-medium text-slate-300">Latest 20</span>
        </div>
        <div className="mt-4 grid gap-3">
          {dryRuns.slice(0, 20).map((run) => (
            <div className="rounded-lg border border-slate-800 p-3 text-sm" key={run.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{run.tool} / {run.action}</p>
                  <p className="mt-1 max-w-3xl text-slate-200">{run.reason}</p>
                  <p className="mt-2 text-xs text-slate-300">Session {run.sessionId}</p>
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
          {dryRuns.length === 0 && <p className="text-sm text-slate-300">No predicted effects available yet.</p>}
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
