import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type IntentRecordRow = {
  id: string;
  sessionId: string;
  userPromptRedacted: string;
  extractedIntentJson: unknown;
  allowedIntentCategoriesJson: unknown;
  forbiddenIntentCategoriesJson: unknown;
  createdAt: Date;
};

type ActionCheckRow = {
  id: string;
  sessionId: string;
  intentRecordId: string;
  tool: string;
  action: string;
  target: string | null;
  intentMatchScore: number;
  decision: string;
  riskLevel: string;
  reason: string;
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

export default async function IntentGuardPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const [records, checks] = await Promise.all([
    safeRows<IntentRecordRow>`
      SELECT "id", "sessionId", "userPromptRedacted", "extractedIntentJson",
        "allowedIntentCategoriesJson", "forbiddenIntentCategoriesJson", "createdAt"
      FROM "AgentIntentRecord"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `,
    safeRows<ActionCheckRow>`
      SELECT "id", "sessionId", "intentRecordId", "tool", "action", "target",
        "intentMatchScore", "decision", "riskLevel", "reason", "createdAt"
      FROM "AgentIntentActionCheck"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `,
  ]);

  const blocked = checks.filter((check) => check.decision === "BLOCK").length;
  const approvals = checks.filter((check) => check.decision === "ASK_APPROVAL").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Intent guard</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Verify planned agent actions against the original user request before execution.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Intent records" value={records.length} tone="gray" />
        <Metric label="Blocked mismatches" value={blocked} tone="red" />
        <Metric label="Approval holds" value={approvals} tone="yellow" />
      </div>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Planned action checks</h2>
          <span className="text-xs font-medium text-slate-500">{checks.length} recent</span>
        </div>
        <table className="mt-4 w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Decision</th>
              <th>Risk</th>
              <th>Match</th>
              <th>Tool</th>
              <th>Action</th>
              <th>Target</th>
              <th>Reason</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {checks.map((check) => (
              <tr key={check.id}>
                <td className="py-3"><Badge value={check.decision} /></td>
                <td className={`font-semibold ${RISK_TONE[check.riskLevel] ?? "text-slate-400"}`}>{check.riskLevel}</td>
                <td>{Math.round(check.intentMatchScore * 100)}%</td>
                <td className="font-mono text-xs">{check.tool}</td>
                <td>{check.action}</td>
                <td className="max-w-[180px] truncate text-slate-400">{check.target ?? "-"}</td>
                <td className="max-w-[320px] truncate text-slate-400">{check.reason}</td>
                <td>{check.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {checks.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={8}>No intent action checks recorded yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Session intent timeline</h2>
          <span className="text-xs font-medium text-slate-500">{records.length} intents</span>
        </div>
        <div className="mt-4 grid gap-3">
          {records.map((record) => {
            const intent = asIntent(record.extractedIntentJson);
            const sessionChecks = checks.filter((check) => check.intentRecordId === record.id);
            return (
              <div className="rounded-lg border border-slate-800 p-3 text-sm" key={record.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{intent.primaryCategory}</p>
                    <p className="mt-1 max-w-3xl text-slate-400">{record.userPromptRedacted}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatList(intent.categories)} . confidence {Math.round(intent.confidence * 100)}%</p>
                  </div>
                  <span className="font-mono text-xs text-slate-500">{record.sessionId}</span>
                </div>
                {sessionChecks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sessionChecks.slice(0, 4).map((check) => <Badge key={check.id} value={check.decision} />)}
                  </div>
                )}
              </div>
            );
          })}
          {records.length === 0 && <p className="text-sm text-slate-500">Extract intent through the API or SDK to populate this timeline.</p>}
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

function asIntent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { primaryCategory: "UNKNOWN", categories: ["UNKNOWN"], confidence: 0 };
  const record = value as { primaryCategory?: unknown; categories?: unknown; confidence?: unknown };
  return {
    primaryCategory: typeof record.primaryCategory === "string" ? record.primaryCategory : "UNKNOWN",
    categories: Array.isArray(record.categories) ? record.categories.filter((item): item is string => typeof item === "string") : ["UNKNOWN"],
    confidence: typeof record.confidence === "number" ? record.confidence : 0,
  };
}

function formatList(values: string[]) {
  if (values.length === 0) return "-";
  return values.slice(0, 4).join(", ") + (values.length > 4 ? ` +${values.length - 4}` : "");
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}
