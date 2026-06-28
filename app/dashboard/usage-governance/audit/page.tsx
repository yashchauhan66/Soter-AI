import { Activity } from "lucide-react";
import { getActiveOrganization } from "@/lib/auth/guards";
import { queryAuditLogs } from "@/lib/usage-governance";

export const dynamic = "force-dynamic";

export default async function GovernanceAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; decision?: string; limit?: string }>;
}) {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const params = await searchParams;
  const { logs, total } = await queryAuditLogs(active.org.id, {
    action: params.action,
    decision: params.decision,
    limit: Number(params.limit ?? 100),
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 text-3xl font-bold">Audit Trail</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Complete audit log of AI usage governance events, including policy changes,
          approval decisions, and usage monitoring events across your organization.
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Action</label>
            <select name="action" className="input text-sm">
              <option value="">All actions</option>
              <option value="USAGE_EVENT">Usage Events</option>
              <option value="POLICY_CHANGE">Policy Changes</option>
              <option value="APPROVAL_GRANTED">Approvals Granted</option>
              <option value="APPROVAL_DENIED">Approvals Denied</option>
              <option value="APPROVAL_REQUESTED">Approval Requests</option>
              <option value="RULE_ADDED">Rules Added</option>
              <option value="DEPARTMENT_ADDED">Departments Added</option>
              <option value="DATA_CLASSIFICATION_ADDED">Data Classifications</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Decision</label>
            <select name="decision" className="input text-sm">
              <option value="">All decisions</option>
              <option value="ALLOWED">Allowed</option>
              <option value="BLOCKED">Blocked</option>
              <option value="APPROVED">Approved</option>
              <option value="DENIED">Denied</option>
              <option value="PENDING">Pending</option>
              <option value="MODIFIED">Modified</option>
            </select>
          </div>
          <button className="button-primary text-sm" type="submit">Filter</button>
        </form>
      </div>

      <p className="text-sm text-slate-500">{total} log entries</p>

      {logs.length === 0 ? (
        <p className="text-sm text-slate-500">No audit logs found.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div className="card flex items-start gap-4 p-4" key={log.id}>
              <Activity size={16} className="mt-0.5 text-cyan" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium">
                    {log.action.replace(/_/g, " ")}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    log.decision === "ALLOWED" || log.decision === "APPROVED" || log.decision === "ALLOW"
                      ? "bg-emerald-500/10 text-emerald-300"
                      : log.decision === "BLOCKED" || log.decision === "BLOCK" || log.decision === "DENIED"
                        ? "bg-red-500/10 text-red-300"
                        : "bg-amber-500/10 text-amber-300"
                  }`}>
                    {log.decision}
                  </span>
                  {log.providerName && (
                    <span className="text-xs text-slate-400">{log.providerName}</span>
                  )}
                  {log.modelName && (
                    <span className="text-xs text-slate-500">· {log.modelName}</span>
                  )}
                </div>
                {log.reason && (
                  <p className="mt-1 text-sm text-slate-400">{log.reason}</p>
                )}
                <p className="mt-1 text-xs text-slate-600">
                  {new Date(log.createdAt).toLocaleString()}
                  {log.userId && ` · User: ${log.userId.slice(0, 8)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
