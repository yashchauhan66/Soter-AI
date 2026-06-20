import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, RiskLevel } from "@/components/dashboard/MetricCard";

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
      <FeatureGuide
        eyebrow="Agent security"
        title="Intent guard"
        description="Verify planned agent actions against the original user request before execution. Prevents agents from going off-course or performing actions the user didn't authorize."
        useCase="AI agents can misinterpret user requests or be tricked into performing actions that don't match the user's original intent. For example, a user asks 'find my emails from last week' but the agent decides to 'delete all emails from last month'. Intent guard checks every planned action against the extracted user intent before allowing execution."
        howItWorks={[
          { heading: "Extract user intent", body: "When a user submits a request, the system extracts the user's intent — the primary goal, categories of actions, and specific constraints." },
          { heading: "Record allowed scope", body: "The extracted intent defines the allowed action categories and any explicitly forbidden categories for the session." },
          { heading: "Check every action", body: "Before each tool call or action, the system checks whether the planned action matches the original user intent. Actions that don't match are scored by intent mismatch severity." },
          { heading: "Block or flag mismatches", body: "Actions that significantly deviate from the user's intent are blocked. Minor mismatches are flagged for review. All checks are logged with match scores and decisions." },
        ]}
        integrationCode={`import { Soter } from "@soter/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
});

// Step 1: Extract intent from user's request
const intent = await soter.extractIntent({
  sessionId: "session-123",
  userPrompt: "Find my emails from last week",
});

// Step 2: Check each action before executing
const check = await soter.checkIntentAction({
  sessionId: "session-123",
  tool: "email.delete",
  action: "delete_all",
  target: "inbox",
});

if (check.decision !== "ALLOW") {
  throw new Error(\`Action not allowed: \${check.reason}\`);
}`}
        callout="Intent guard requires SDK integration to extract intent from user prompts and check actions before execution. It is most effective when combined with tool chain detection and blast radius analysis for comprehensive agent protection."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Intent records" value={records.length} tone="gray" />
        <MetricCard label="Blocked mismatches" value={blocked} tone="red" />
        <MetricCard label="Approval holds" value={approvals} tone="yellow" />
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
                <td className="py-3"><StatusBadge value={check.decision} /></td>
                <td><RiskLevel level={check.riskLevel} /></td>
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
                    {sessionChecks.slice(0, 4).map((check) => <StatusBadge key={check.id} value={check.decision} />)}
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
