import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { resolveDashboardEscrow } from "./actions";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { MetricCard, StatusBadge, PayloadViewer, RiskLevel } from "@/components/dashboard/MetricCard";

export const dynamic = "force-dynamic";

type EscrowRow = {
  id: string;
  sessionId: string;
  agentIdentityId: string | null;
  transactionType: string;
  tool: string;
  action: string;
  target: string | null;
  originalPayloadRedacted: string | null;
  safePayload: string | null;
  riskLevel: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  executedAt: Date | null;
};

type AuditRow = {
  id: string;
  escrowTransactionId: string;
  action: string;
  actorType: string;
  reason: string | null;
  createdAt: Date;
};



export default async function EscrowPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");

  const [transactions, audits] = await Promise.all([
    safeRows<EscrowRow>`
      SELECT "id", "sessionId", "agentIdentityId", "transactionType", "tool", "action", "target",
        "originalPayloadRedacted", "safePayload", "riskLevel", "status", "expiresAt",
        "createdAt", "resolvedAt", "executedAt"
      FROM "AgentEscrowTransaction"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 100
    `,
    safeRows<AuditRow>`
      SELECT "id", "escrowTransactionId", "action", "actorType", "reason", "createdAt"
      FROM "AgentEscrowAudit"
      WHERE "projectId" = ${project.id}
      ORDER BY "createdAt" DESC
      LIMIT 200
    `,
  ]);

  const pending = transactions.filter((transaction) => transaction.status === "PENDING");
  const executed = transactions.filter((transaction) => transaction.status === "EXECUTED").length;
  const blocked = transactions.filter((transaction) => transaction.status === "DENIED" || transaction.status === "EXPIRED").length;

  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Transaction escrow"
        description="Hold risky or irreversible agent actions for review before execution."
        useCase="Escrow protects your users and your infrastructure by pausing every high-risk agent action until a human approves, edits, or denies it. Without escrow, a single compromised agent could execute destructive operations like deleting databases, transferring funds, or modifying production configuration — all before anyone can intervene."
        howItWorks={[
          { heading: "Agent requests action", body: "When an agent attempts a risky action (e.g., DELETE API call, fund transfer), the action is intercepted and held in escrow rather than executed immediately." },
          { heading: "Human reviews payload", body: "The dashboard approval inbox shows the pending action with its original redacted payload, safe payload, risk level, and target. You can inspect exactly what would have happened." },
          { heading: "Decide, approve, or deny", body: "Choose to approve the original action, edit and approve a modified version, or deny it entirely. Every decision is logged in the audit trail." },
          { heading: "Audit trail preserved", body: "All escrow decisions — approvals, denials, edits, and cancellations — are permanently recorded with actor type, reason, and timestamp for compliance and post-incident review." },
        ]}
        callout="Escrow does not guarantee protection against every malicious action. Combine with least-privilege design, intent guard, and tool-chain detection for defense in depth."
      />
      <ProjectSwitcher projects={projects} selectedId={project.id} />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Transactions" value={transactions.length} tone="gray" />
        <MetricCard label="Pending" value={pending.length} tone="yellow" />
        <MetricCard label="Executed" value={executed} tone="cyan" />
        <MetricCard label="Denied/expired" value={blocked} tone="red" />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Approval inbox</h2>
          <span className="text-xs font-medium text-slate-500">{pending.length} pending</span>
        </div>
        <div className="mt-4 grid gap-4">
          {pending.map((transaction) => (
            <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3 text-sm" key={transaction.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-yellow-200">{transaction.tool} / {transaction.action}</p>
                  <p className="mt-1 text-slate-400">{transaction.transactionType} to {transaction.target ?? "unknown target"}</p>
                  <p className="mt-1 text-xs text-slate-500">Session {transaction.sessionId} · expires {transaction.expiresAt.toLocaleString()}</p>
                </div>
                <RiskLevel level={transaction.riskLevel} />
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <PayloadViewer title="Original redacted payload" value={transaction.originalPayloadRedacted} />
                <PayloadViewer title="Safe payload" value={transaction.safePayload ?? transaction.originalPayloadRedacted} />
              </div>
              <form action={resolveDashboardEscrow} className="mt-3 grid gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="escrowId" value={transaction.id} />
                <textarea
                  className="min-h-24 rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200"
                  name="editedPayload"
                  defaultValue={transaction.safePayload ?? transaction.originalPayloadRedacted ?? ""}
                />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary" name="decision" value="DENIED">Deny</button>
                  <button className="btn-secondary" name="decision" value="EDITED_AND_APPROVED">Edit and approve</button>
                  <button className="btn-primary" name="decision" value="APPROVED">Approve original</button>
                </div>
              </form>
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-slate-500">No pending escrow transactions.</p>}
        </div>
      </section>

      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent transactions</h2>
          <span className="text-xs font-medium text-slate-500">{transactions.length} recent</span>
        </div>
        <table className="mt-4 w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Status</th>
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
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="py-3"><StatusBadge value={transaction.status} /></td>
                <td className="font-semibold"><RiskLevel level={transaction.riskLevel} /></td>
                <td>{transaction.transactionType}</td>
                <td className="font-mono text-xs text-slate-400">{transaction.tool}</td>
                <td>{transaction.action}</td>
                <td className="max-w-[220px] truncate text-slate-400">{transaction.target ?? "-"}</td>
                <td className="font-mono text-xs text-slate-500">{transaction.sessionId}</td>
                <td>{transaction.createdAt.toLocaleString()}</td>
              </tr>
            ))}
            {transactions.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={8}>No escrow transactions recorded yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Audit trail</h2>
          <span className="text-xs font-medium text-slate-500">{audits.length} events</span>
        </div>
        <div className="mt-4 grid gap-2">
          {audits.slice(0, 20).map((audit) => (
            <div className="rounded-lg border border-slate-800 p-3 text-sm" key={audit.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{audit.action} <span className="text-xs text-slate-500">by {audit.actorType}</span></p>
                <span className="text-xs text-slate-500">{audit.createdAt.toLocaleString()}</span>
              </div>
              {audit.reason && <p className="mt-1 text-slate-400">{audit.reason}</p>}
            </div>
          ))}
          {audits.length === 0 && <p className="text-sm text-slate-500">No escrow audit events yet.</p>}
        </div>
      </section>
    </div>
  );
}



async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try {
    return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values);
  } catch {
    return [];
  }
}
