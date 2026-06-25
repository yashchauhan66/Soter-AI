import { AgentFirewallPolicyForm } from "@/components/dashboard/AgentFirewallPolicyForm";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { defaultAgentFirewallPolicy } from "@/lib/agent-firewall";
import { db } from "@/lib/db";
import { AGENT_FIREWALL_PREVIEW_GAPS } from "@/lib/agent-firewall";
import { resolveDashboardAgentApproval } from "./actions";

export const dynamic = "force-dynamic";

type SessionRow = { id: string; agentName: string; agentType: string; status: string; createdAt: Date };
type LogRow = { id: string; tool: string; action: string; destination: string; decision: string; riskLevel: string; reason: string; createdAt: Date };
type ApprovalRow = {
  id: string;
  status: string;
  reason: string;
  requestedAction: unknown;
  requestedContentRedacted: string | null;
  safeContent: string | null;
  expiresAt: Date;
  createdAt: Date;
  tool: string | null;
  action: string | null;
  target: string | null;
  destination: string | null;
  riskLevel: string | null;
};
type PolicyRow = { rulesJson: unknown };

export default async function AgentFirewallPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  await requireProjectPermission(project.id, "policy:manage");

  const [sessions, logs, approvals, policyRows] = await Promise.all([
    safeRows<SessionRow>`SELECT "id", "agentName", "agentType", "status", "createdAt" FROM "AgentSession" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 8`,
    safeRows<LogRow>`SELECT "id", "tool", "action", "destination", "decision", "riskLevel", "reason", "createdAt" FROM "AgentActionLog" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 12`,
    safeRows<ApprovalRow>`SELECT a."id", a."status", a."reason", a."requestedAction", a."requestedContentRedacted", a."safeContent", a."expiresAt", a."createdAt", l."tool", l."action", l."target", l."destination", l."riskLevel" FROM "AgentApproval" a LEFT JOIN "AgentActionLog" l ON l."id" = a."actionLogId" WHERE a."projectId" = ${project.id} AND a."status" = 'PENDING' ORDER BY a."createdAt" DESC LIMIT 6`,
    safeRows<PolicyRow>`SELECT "rulesJson" FROM "AgentPolicy" WHERE "projectId" = ${project.id} AND "enabled" = true ORDER BY "updatedAt" DESC LIMIT 1`,
  ]);

  const policy = normalizePolicy(policyRows[0]?.rulesJson);
  const blocked = logs.filter((log) => log.decision === "BLOCK").length;
  const approvalRequired = logs.filter((log) => log.decision === "ASK_APPROVAL").length;
  const allowed = logs.filter((log) => log.decision === "ALLOW" || log.decision === "READ_ONLY").length;
  const exfiltrationBlocks = logs.filter((log) => log.decision === "BLOCK" && /exfiltration|external|secret|sensitive/i.test(log.reason)).slice(0, 5);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent firewall</p>
          <h1 className="mt-2 text-3xl font-bold">Computer-use guardrails</h1>
          <p className="mt-3 max-w-3xl text-slate-400">
            Every browser, file, email, terminal, MCP, API, and RAG tool action is checked before execution and logged with redacted-only content. (Note: this is preview tracking, not runtime agent enforcement yet.)
          </p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <nav className="flex flex-wrap gap-2 text-xs">
        {[
          ["Sessions", "sessions"],
          ["Approvals", "approvals"],
          ["Policies", "policies"],
          ["MCP scanner", "mcp-scanner"],
          ["RAG trust", "rag-trust"],
          ["Canaries", "canaries"],
          ["Replay", "replay"],
        ].map(([label, slug]) => (
          <a
            className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500 hover:text-white"
            href={`/dashboard/agent-firewall/${slug}?project=${project.id}`}
            key={slug}
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Active sessions" value={sessions.filter((item) => item.status === "ACTIVE").length} tone="gray" />
        <Metric label="Allowed/read-only" value={allowed} tone="green" />
        <Metric label="Approval required" value={approvalRequired + approvals.length} tone="yellow" />
        <Metric label="Blocked" value={blocked} tone="red" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent tool/action logs</h2>
            <div className="flex gap-2 text-xs">
              <span className="rounded bg-emerald-400/10 px-2 py-1 text-emerald-300">Allowed</span>
              <span className="rounded bg-yellow-400/10 px-2 py-1 text-yellow-300">Approval</span>
              <span className="rounded bg-red-400/10 px-2 py-1 text-red-300">Blocked</span>
              <span className="rounded bg-slate-700 px-2 py-1 text-slate-300">Read-only</span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2">Decision</th><th>Risk</th><th>Tool</th><th>Action</th><th>Destination</th><th>Reason</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3"><DecisionBadge decision={log.decision} /></td>
                    <td><RiskBadge risk={log.riskLevel} /></td>
                    <td className="font-mono text-xs">{log.tool}</td>
                    <td>{log.action}</td>
                    <td>{log.destination}</td>
                    <td className="max-w-[260px] truncate text-slate-400">{log.reason}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={6}>No agent actions logged yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-semibold">Approval inbox</h2>
          <div className="mt-4 space-y-3">
            {approvals.map((approval) => (
              <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3 text-sm" key={approval.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-yellow-200">{approval.tool ?? "agent.action"} / {approval.action ?? "approval"}</p>
                    <p className="mt-1 text-slate-400">{approval.reason}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {approval.destination ?? "unknown"} {approval.target ? `- ${approval.target}` : ""} - expires {approval.expiresAt.toLocaleString()}
                    </p>
                  </div>
                  {approval.riskLevel && <RiskBadge risk={approval.riskLevel} />}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Original redacted</p>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-950/70 p-2 text-xs text-slate-300">{approval.requestedContentRedacted ?? "No content supplied."}</pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Safe content</p>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-950/70 p-2 text-xs text-slate-300">{approval.safeContent ?? approval.requestedContentRedacted ?? "No content supplied."}</pre>
                  </div>
                </div>
                <form action={resolveDashboardAgentApproval} className="mt-3 grid gap-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="approvalId" value={approval.id} />
                  <textarea
                    className="input min-h-20 text-xs"
                    name="editedContent"
                    defaultValue={approval.safeContent ?? approval.requestedContentRedacted ?? ""}
                    aria-label="Edited safe content"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button className="button-primary" name="decision" value="APPROVED" type="submit">Approve</button>
                    <button className="button-secondary" name="decision" value="DENIED" type="submit">Deny</button>
                  </div>
                </form>
              </div>
            ))}
            {approvals.length === 0 && <p className="text-sm text-slate-500">No pending approvals.</p>}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-lg font-semibold">Agent sessions</h2>
          <div className="mt-4 grid gap-2">
            {sessions.map((session) => (
              <div className="grid gap-2 rounded-lg border border-slate-800 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center" key={session.id}>
                <div>
                  <p className="font-semibold">{session.agentName}</p>
                  <p className="text-xs text-slate-500">{session.agentType} - {session.id}</p>
                </div>
                <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{session.status}</span>
              </div>
            ))}
            {sessions.length === 0 && <p className="text-sm text-slate-500">Start an agent session from the SDK to see sessions here.</p>}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-semibold">Recent blocked exfiltration</h2>
          <div className="mt-4 space-y-3">
            {exfiltrationBlocks.map((log) => (
              <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm" key={log.id}>
                <p className="font-mono text-xs text-red-200">{log.tool} / {log.action}</p>
                <p className="mt-1 text-slate-400">{log.reason}</p>
              </div>
            ))}
            {exfiltrationBlocks.length === 0 && <p className="text-sm text-slate-500">No blocked exfiltration attempts logged.</p>}
          </div>
        </section>
      </div>

      <AgentFirewallPolicyForm projectId={project.id} initial={policy} />

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Copy-paste integration</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{`import { createAgentFirewallClient } from "@cybersecurityguard/guard";

const firewall = createAgentFirewallClient({
  apiKey: process.env.CYBERSECURITYGUARD_API_KEY!,
  baseUrl: process.env.CYBERSECURITYGUARD_BASE_URL
});

const session = await firewall.startAgentSession({
  agentName: "openclaw",
  agentType: "computer_use"
});

const checked = await firewall.checkAgentAction({
  sessionId: session.sessionId,
  tool: "gmail.send",
  action: "send_email",
  target: "client@example.com",
  content: emailBody,
  destination: "external",
  riskContext: { externalDestination: true, canSendMessage: true, canModifyData: true }
});

if (checked.decision === "BLOCK") throw new Error(checked.reason);
if (checked.decision === "ASK_APPROVAL") return checked.requiredApproval;

await sendEmail(checked.safeContent ?? emailBody);`}</pre>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold">Agent firewall preview gap list</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
          {AGENT_FIREWALL_PREVIEW_GAPS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, index) => `${sql}${chunk}${index < values.length ? `$${index + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}

function normalizePolicy(value: unknown) {
  const defaults = defaultAgentFirewallPolicy();
  return value && typeof value === "object" ? { ...defaults, ...(value as Partial<typeof defaults>) } : defaults;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "green" | "yellow" | "red" | "gray" }) {
  const tones = {
    green: "text-emerald-300",
    yellow: "text-yellow-300",
    red: "text-red-300",
    gray: "text-slate-300",
  };
  return (
    <section className="card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </section>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  const cls = decision === "BLOCK"
    ? "bg-red-400/10 text-red-300"
    : decision === "ASK_APPROVAL"
      ? "bg-yellow-400/10 text-yellow-300"
      : decision === "READ_ONLY" || decision === "SANDBOX_ONLY"
        ? "bg-slate-700 text-slate-300"
        : "bg-emerald-400/10 text-emerald-300";
  return <span className={`rounded px-2 py-1 text-xs font-medium ${cls}`}>{decision}</span>;
}

function RiskBadge({ risk }: { risk: string }) {
  const cls = risk === "CRITICAL"
    ? "text-red-300"
    : risk === "HIGH"
      ? "text-yellow-300"
      : risk === "MEDIUM"
        ? "text-cyan"
        : "text-slate-400";
  return <span className={`text-xs font-semibold ${cls}`}>{risk}</span>;
}
