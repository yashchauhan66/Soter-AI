import Link from "next/link";
import { ShieldCheck, RotateCcw, Fingerprint, Gauge } from "lucide-react";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { MetricCard, RiskLevel, StatusBadge } from "@/components/dashboard/MetricCard";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { buildAgentControlMetrics, rollbackWindowState } from "@/lib/agent-control";
import { evaluateContinuousAssurance } from "@/lib/compliance/assurance";
import { db } from "@/lib/db";
import { resolveDashboardAgentApproval } from "../agent-firewall/actions";
import { resolveDashboardEscrow } from "../escrow/actions";
import { stageDashboardRollback } from "./actions";

export const dynamic = "force-dynamic";

type ActionLog = { id: string; tool: string; action: string; target: string | null; destination: string; decision: string; riskLevel: string; reason: string; createdAt: Date };
type Approval = { id: string; status: string; reason: string; requestedContentRedacted: string | null; safeContent: string | null; expiresAt: Date; tool: string | null; action: string | null; target: string | null; riskLevel: string | null };
type Escrow = { id: string; status: string; tool: string; action: string; target: string | null; riskLevel: string; originalPayloadRedacted: string | null; safePayload: string | null; expiresAt: Date };
type Ledger = { id: string; tool: string; action: string; targetRedacted: string | null; reversalStatus: string; decision: string; riskLevel: string; rollbackDeadline: Date | null; rollbackStatus: string; irreversibleReason: string | null; summary: string; createdAt: Date };
type Evidence = { id: string; evidenceType: string; controlName: string; status: string; riskLevel: string | null; contentHash: string | null; createdAt: Date };
export default async function AgentControlPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  const access = await requireProjectPermission(project.id, "logs:read");
  const canManage = access.user.isAdmin || hasPermission(access.role, "policy:manage");

  const [logs, approvals, escrow, ledger, evidence, operatorAudits] = await Promise.all([
    safeRows<ActionLog>`SELECT "id", "tool", "action", "target", "destination", "decision", "riskLevel", "reason", "createdAt" FROM "AgentActionLog" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`,
    safeRows<Approval>`SELECT a."id", a."status", a."reason", a."requestedContentRedacted", a."safeContent", a."expiresAt", l."tool", l."action", l."target", l."riskLevel" FROM "AgentApproval" a LEFT JOIN "AgentActionLog" l ON l."id" = a."actionLogId" WHERE a."projectId" = ${project.id} AND a."status" = 'PENDING' ORDER BY a."createdAt" DESC LIMIT 20`,
    safeRows<Escrow>`SELECT "id", "status", "tool", "action", "target", "riskLevel", "originalPayloadRedacted", "safePayload", "expiresAt" FROM "AgentEscrowTransaction" WHERE "projectId" = ${project.id} AND "status" = 'PENDING' ORDER BY "createdAt" DESC LIMIT 20`,
    safeRows<Ledger>`SELECT "id", "tool", "action", "targetRedacted", "reversalStatus", "decision", "riskLevel", "rollbackDeadline", "rollbackStatus", "irreversibleReason", "summary", "createdAt" FROM "AgentActionLedger" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`,
    safeRows<Evidence>`SELECT "id", "evidenceType", "controlName", "status", "riskLevel", "contentHash", "createdAt" FROM "ComplianceEvidenceItem" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 300`,
    db.organizationAuditLog.findMany({ where: { organizationId: access.org.id, category: "AGENT_CONTROL" }, select: { id: true, actorUserId: true, action: true, metadata: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const metrics = buildAgentControlMetrics({ logs, approvals, escrowApprovals: escrow, ledger, evidence });
  const assurance = evaluateContinuousAssurance({ evidence });
  const pending = approvals.length + escrow.length;

  return (
    <div className="space-y-6">
      {/* ── Premium Hero Header ── */}
      <header className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-slate-950/60 p-6 sm:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-300">Core product</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
                <Gauge size={20} className="text-orange-300" />
              </span>
              <div>
                <h1 className="text-3xl font-bold sm:text-4xl">Agent Control Center</h1>
                <p className="mt-1 text-sm text-slate-400">High-trust operations for AI agents</p>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-slate-300">
              Approve risky tool use, trace every decision, stage safe compensating actions, and keep auditor-ready proof across email, CRM, database, and payment agents.
            </p>
          </div>
          <ProjectSwitcher projects={projects} selectedId={project.id} />
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <HeroFeature icon={<ShieldCheck size={18} />} title="Action approval" text="Hold risky tool calls for human review before execution." />
          <HeroFeature icon={<RotateCcw size={18} />} title="Reversibility ledger" text="Stage compensating actions for safe rollback with audit trail." />
          <HeroFeature icon={<Fingerprint size={18} />} title="Compliance proof" text="Continuous assurance with SOC 2 and ISO 27001 evidence." />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Awaiting human" value={metrics.pendingApprovals} tone={metrics.pendingApprovals ? "yellow" : "green"} />
        <MetricCard label="Blocked actions" value={metrics.blockedActions} tone={metrics.blockedActions ? "red" : "gray"} />
        <MetricCard label="Reversible actions" value={metrics.reversibleActions} tone="cyan" />
        <MetricCard label="Rollback staged" value={metrics.rollbackReady} tone="blue" />
        <MetricCard label="Control assurance" value={`${assurance.assuranceScore}%`} tone={assurance.overallStatus === "PASS" ? "green" : assurance.overallStatus === "FAIL" ? "red" : "yellow"} />
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Human approval queue</h2><p className="mt-1 text-sm text-slate-400">A single queue for firewall holds and transaction escrow. Payloads shown here are already redacted.</p></div>
          <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">{pending} pending</span>
        </div>
        {!canManage && <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">Viewer mode: policy management permission is required to approve or deny actions.</p>}
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {approvals.map((item) => (
            <article className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4" key={item.id}>
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.tool ?? "agent.action"} / {item.action ?? "approval"}</p><p className="mt-1 text-sm text-slate-400">{item.reason}</p></div><RiskLevel level={item.riskLevel ?? "HIGH"} /></div>
              <p className="mt-2 text-xs text-slate-500">Target: {item.target ?? "unknown"} · expires {item.expiresAt.toLocaleString()}</p>
              <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-slate-950/70 p-3 text-xs text-slate-300">{item.safeContent ?? item.requestedContentRedacted ?? "No payload supplied."}</pre>
              {canManage && <form action={resolveDashboardAgentApproval} className="mt-3 grid gap-2"><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="approvalId" value={item.id} /><textarea className="input min-h-20 text-xs" name="editedContent" defaultValue={item.safeContent ?? item.requestedContentRedacted ?? ""} aria-label="Approved payload" /><div className="flex gap-2"><button className="button-secondary" name="decision" value="DENIED">Deny</button><button className="button-primary" name="decision" value="APPROVED">Approve safely</button></div></form>}
            </article>
          ))}
          {escrow.map((item) => (
            <article className="rounded-xl border border-orange-400/20 bg-orange-400/5 p-4" key={item.id}>
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Escrow · {item.tool} / {item.action}</p><p className="mt-1 text-sm text-slate-400">Held before execution against {item.target ?? "unknown target"}.</p></div><RiskLevel level={item.riskLevel} /></div>
              <p className="mt-2 text-xs text-slate-500">Expires {item.expiresAt.toLocaleString()}</p>
              <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-slate-950/70 p-3 text-xs text-slate-300">{item.safePayload ?? item.originalPayloadRedacted ?? "No payload supplied."}</pre>
              {canManage && <form action={resolveDashboardEscrow} className="mt-3 grid gap-2"><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="escrowId" value={item.id} /><textarea className="input min-h-20 text-xs" name="editedPayload" defaultValue={item.safePayload ?? item.originalPayloadRedacted ?? ""} aria-label="Escrow payload" /><div className="flex gap-2"><button className="button-secondary" name="decision" value="DENIED">Deny</button><button className="button-primary" name="decision" value="APPROVED">Approve original</button></div></form>}
            </article>
          ))}
          {pending === 0 && <p className="text-sm text-slate-500">No agent actions are waiting for human review.</p>}
        </div>
      </section>

      <section className="card overflow-x-auto p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Reversibility ledger</h2><p className="mt-1 text-sm text-slate-400">A rollback request stages the stored compensating action for an authorized connector; it does not falsely mark an external change as reversed.</p></div><Link className="text-sm text-cyan hover:underline" href={`/dashboard/forensics?project=${project.id}`}>Open forensics</Link></div>
        <table className="mt-4 w-full min-w-[1100px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Window</th><th>Risk</th><th>Tool action</th><th>Target</th><th>Policy</th><th>Recorded</th><th>Operator action</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {ledger.map((item) => { const window = rollbackWindowState(item); return <tr key={item.id}><td className="py-3"><StatusBadge value={window} /></td><td><RiskLevel level={item.riskLevel} /></td><td><p className="font-mono text-xs">{item.tool}</p><p>{item.action}</p></td><td className="max-w-[220px] truncate text-slate-400">{item.targetRedacted ?? "-"}</td><td><StatusBadge value={item.decision} /></td><td className="text-xs text-slate-400">{item.createdAt.toLocaleString()}</td><td>{window === "AVAILABLE" && canManage ? <form action={stageDashboardRollback} className="flex min-w-[290px] gap-2"><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="ledgerId" value={item.id} /><input className="input min-w-0 flex-1 text-xs" name="reason" minLength={8} maxLength={500} required placeholder="Incident or rollback reason" /><button className="button-secondary whitespace-nowrap">Stage rollback</button></form> : <span className="text-xs text-slate-500">{item.irreversibleReason ?? item.summary}</span>}</td></tr>; })}
            {ledger.length === 0 && <tr><td className="py-6 text-slate-500" colSpan={7}>No ledger entries yet. Send agent actions to the action-ledger API to classify reversibility.</td></tr>}
          </tbody>
        </table>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card overflow-x-auto p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Live action audit</h2><Link className="text-sm text-cyan hover:underline" href={`/dashboard/logs?project=${project.id}`}>All logs</Link></div><table className="mt-4 w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Decision</th><th>Risk</th><th>Tool / action</th><th>Destination</th><th>Reason</th><th>When</th></tr></thead><tbody className="divide-y divide-slate-800">{logs.slice(0, 20).map((item) => <tr key={item.id}><td className="py-3"><StatusBadge value={item.decision} /></td><td><RiskLevel level={item.riskLevel} /></td><td><span className="font-mono text-xs">{item.tool}</span> / {item.action}</td><td>{item.destination}</td><td className="max-w-[260px] truncate text-slate-400">{item.reason}</td><td className="text-xs text-slate-500">{item.createdAt.toLocaleString()}</td></tr>)}</tbody></table>{logs.length === 0 && <p className="py-5 text-sm text-slate-500">No agent actions logged yet.</p>}</section>
        <section className="card p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Compliance posture</h2><StatusBadge value={assurance.overallStatus} /></div><p className="mt-2 text-sm text-slate-400">{metrics.freshEvidence} fresh evidence items · {assurance.summary.passing}/{assurance.summary.totalControls} controls passing</p><div className="mt-4 space-y-2">{assurance.controls.map((control) => <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm" key={control.id}><div><p className="font-medium">{control.name}</p><p className="text-xs text-slate-500">{control.id} · {control.evidenceIds.length} fresh items</p></div><StatusBadge value={control.status} /></div>)}</div><Link className="mt-4 inline-block text-sm text-cyan hover:underline" href={`/dashboard/evidence-vault?project=${project.id}`}>Open evidence vault →</Link></section>
      </div>

      <section className="card p-5"><h2 className="text-lg font-semibold">Operator audit trail</h2><p className="mt-1 text-sm text-slate-400">Human rollback decisions are attributed to an operator and retained separately from agent-generated logs.</p><div className="mt-4 space-y-2">{operatorAudits.map((audit) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm" key={audit.id}><div><StatusBadge value={audit.action} /><span className="ml-2 text-slate-400">Actor {audit.actorUserId ?? "system"}</span></div><span className="text-xs text-slate-500">{audit.createdAt.toLocaleString()}</span></div>)}{operatorAudits.length === 0 && <p className="text-sm text-slate-500">No human rollback decisions recorded yet.</p>}</div></section>
    </div>
  );
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, index) => `${sql}${chunk}${index < values.length ? `$${index + 1}` : ""}`, ""), ...values); }
  catch { return []; }
}

function HeroFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex items-center gap-2 text-orange-300">
        {icon}
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
    </div>
  );
}
