import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  sessionId: string;
  agentIdentityId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type StepRow = {
  id: string;
  toolChainSessionId: string;
  stepIndex: number;
  tool: string;
  action: string;
  sourceType: string;
  destinationType: string;
  dataSensitivity: string;
  decision: string;
  riskLevel: string;
  createdAt: Date;
};

type FindingRow = {
  id: string;
  toolChainSessionId: string;
  findingType: string;
  riskLevel: string;
  summary: string;
  involvedStepsJson: unknown;
  recommendation: string;
  createdAt: Date;
};

const DECISION_TONE: Record<string, string> = {
  ALLOW: "bg-emerald-400/10 text-emerald-300",
  ASK_APPROVAL: "bg-yellow-400/10 text-yellow-300",
  REVIEW: "bg-blue-400/10 text-blue-300",
  BLOCK: "bg-red-400/10 text-red-300",
};

const RISK_TONE: Record<string, string> = {
  LOW: "text-emerald-300",
  MEDIUM: "text-amber-300",
  HIGH: "text-orange-300",
  CRITICAL: "text-red-300",
};

export default async function ToolChainPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const [sessions, steps, findings] = await Promise.all([
    safeRows<SessionRow>`
      SELECT "id", "sessionId", "agentIdentityId", "status", "createdAt", "updatedAt"
      FROM "ToolChainSession"
      WHERE "projectId" = ${project.id}
      ORDER BY "updatedAt" DESC
      LIMIT 50
    `,
    safeRows<StepRow>`
      SELECT "id", "toolChainSessionId", "stepIndex", "tool", "action", "sourceType",
        "destinationType", "dataSensitivity", "decision", "riskLevel", "createdAt"
      FROM "ToolChainStep"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 150
    `,
    safeRows<FindingRow>`
      SELECT "id", "toolChainSessionId", "findingType", "riskLevel", "summary",
        "involvedStepsJson", "recommendation", "createdAt"
      FROM "ToolChainFinding"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `,
  ]);

  const blocked = steps.filter((step) => step.decision === "BLOCK").length;
  const review = steps.filter((step) => step.decision === "REVIEW" || step.decision === "ASK_APPROVAL").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Tool chain detector</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Detect risky multi-tool sequences where safe individual steps combine into exfiltration, poisoning, or privilege escalation paths.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Sessions" value={sessions.length} tone="gray" />
        <Metric label="Steps" value={steps.length} tone="gray" />
        <Metric label="Blocked chains" value={blocked} tone="red" />
        <Metric label="Review holds" value={review} tone="yellow" />
      </div>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Chain timeline</h2>
          <span className="text-xs font-medium text-slate-500">{steps.length} recent steps</span>
        </div>
        <table className="mt-4 w-full min-w-[1080px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Decision</th>
              <th>Risk</th>
              <th>Step</th>
              <th>Source</th>
              <th>Action</th>
              <th>Destination</th>
              <th>Data</th>
              <th>Tool</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {steps.map((step) => (
              <tr key={step.id}>
                <td className="py-3"><Badge value={step.decision} /></td>
                <td className={`font-semibold ${RISK_TONE[step.riskLevel] ?? "text-slate-400"}`}>{step.riskLevel}</td>
                <td>#{step.stepIndex}</td>
                <td>{step.sourceType}</td>
                <td>{step.action}</td>
                <td>{step.destinationType}</td>
                <td>{step.dataSensitivity}</td>
                <td className="font-mono text-xs text-slate-400">{step.tool}</td>
                <td>{step.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {steps.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={9}>No tool chain steps recorded yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Findings</h2>
          <span className="text-xs font-medium text-slate-500">{findings.length} recent</span>
        </div>
        <div className="mt-4 grid gap-3">
          {findings.map((finding) => (
            <div className="rounded-lg border border-slate-800 p-3 text-sm" key={finding.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{finding.findingType}</p>
                  <p className="mt-1 max-w-3xl text-slate-400">{finding.summary}</p>
                  <p className="mt-2 max-w-3xl text-xs text-slate-500">{finding.recommendation}</p>
                </div>
                <span className={`text-xs font-bold ${RISK_TONE[finding.riskLevel] ?? "text-slate-400"}`}>{finding.riskLevel}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Steps {formatSteps(finding.involvedStepsJson)}</p>
            </div>
          ))}
          {findings.length === 0 && <p className="text-sm text-slate-500">No dangerous chain findings recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "yellow" | "red" | "gray" }) {
  const tones = { yellow: "text-yellow-300", red: "text-red-300", gray: "text-slate-300" };
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

function formatSteps(value: unknown) {
  if (!Array.isArray(value)) return "-";
  return value.filter((item): item is number => typeof item === "number").join(" -> ") || "-";
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}
