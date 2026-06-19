import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { resolveDashboardEscrow } from "./actions";

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

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-yellow-400/10 text-yellow-300",
  APPROVED: "bg-emerald-400/10 text-emerald-300",
  DENIED: "bg-red-400/10 text-red-300",
  EXPIRED: "bg-slate-500/10 text-slate-300",
  EXECUTED: "bg-cyan/10 text-cyan",
  CANCELLED: "bg-slate-500/10 text-slate-300",
};

const RISK_TONE: Record<string, string> = {
  LOW: "text-emerald-300",
  MEDIUM: "text-amber-300",
  HIGH: "text-orange-300",
  CRITICAL: "text-red-300",
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agent security</p>
          <h1 className="mt-2 text-3xl font-bold">Transaction escrow</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Hold risky or irreversible agent actions for review before execution.</p>
        </div>
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Transactions" value={transactions.length} tone="gray" />
        <Metric label="Pending" value={pending.length} tone="yellow" />
        <Metric label="Executed" value={executed} tone="cyan" />
        <Metric label="Denied/expired" value={blocked} tone="red" />
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
                <span className={`text-xs font-bold ${RISK_TONE[transaction.riskLevel] ?? "text-slate-400"}`}>{transaction.riskLevel}</span>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Payload title="Original redacted payload" value={transaction.originalPayloadRedacted} />
                <Payload title="Safe payload" value={transaction.safePayload ?? transaction.originalPayloadRedacted} />
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
                <td className="py-3"><Badge value={transaction.status} /></td>
                <td className={`font-semibold ${RISK_TONE[transaction.riskLevel] ?? "text-slate-400"}`}>{transaction.riskLevel}</td>
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

function Metric({ label, value, tone }: { label: string; value: number; tone: "yellow" | "red" | "gray" | "cyan" }) {
  const tones = { yellow: "text-yellow-300", red: "text-red-300", gray: "text-slate-300", cyan: "text-cyan" };
  return (
    <section className="card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </section>
  );
}

function Badge({ value }: { value: string }) {
  return <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_TONE[value] ?? "bg-slate-700 text-slate-300"}`}>{value}</span>;
}

function Payload({ title, value }: { title: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-950/70 p-2 text-xs text-slate-300">{value ?? "No payload supplied."}</pre>
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
