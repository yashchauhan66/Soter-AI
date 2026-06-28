import { Clock, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { getActiveOrganization } from "@/lib/auth/guards";
import { listApprovalRequests } from "@/lib/usage-governance";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, { label: string; icon: any; color: string }> = {
  PENDING: { label: "Pending", icon: Clock, color: "text-amber-300 bg-amber-500/10" },
  APPROVED: { label: "Approved", icon: CheckCircle, color: "text-emerald-300 bg-emerald-500/10" },
  DENIED: { label: "Denied", icon: XCircle, color: "text-red-300 bg-red-500/10" },
  CANCELLED: { label: "Cancelled", icon: HelpCircle, color: "text-slate-400 bg-slate-800" },
};

export default async function GovernanceApprovalsPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const approvals = await listApprovalRequests(active.org.id);
  const pendingRequests = approvals.filter((a) => a.status === "PENDING");

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 text-3xl font-bold">Approval Requests</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Review and manage requests from employees to use AI providers that require approval.
        </p>
      </div>

      {pendingRequests.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          <strong>{pendingRequests.length} pending approval request(s)</strong> requiring your review.
        </div>
      )}

      {approvals.length === 0 ? (
        <p className="text-sm text-slate-500">No approval requests yet.</p>
      ) : (
        <div className="space-y-3">
          {approvals.map((request) => {
            const style = STATUS_STYLES[request.status] ?? STATUS_STYLES.PENDING;
            const Icon = style.icon;
            return (
              <div className="card p-5" key={request.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <Icon size={20} className={style.color.replace("bg-*", "")} />
                    <div>
                      <h3 className="font-semibold">{request.providerName}{request.modelName ? ` - ${request.modelName}` : ""}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Requested by {request.requestedBy?.name ?? request.requestedBy?.email ?? "Unknown user"}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">{request.useCase}</p>
                      {request.justification && (
                        <p className="mt-1 text-sm text-slate-500 italic">{request.justification}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        {new Date(request.createdAt).toLocaleDateString()} 
                        {request.dataSensitivity && ` · Data: ${request.dataSensitivity}`}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.color}`}>
                    {style.label}
                  </span>
                </div>

                {request.status === "PENDING" && (
                  <div className="mt-4 flex gap-3 border-t border-slate-800 pt-4">
                    <form action="/api/usage-governance/approvals/review" method="POST">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="status" value="APPROVED" />
                      <input name="decisionReason" className="input mr-2 text-sm" placeholder="Reason (optional)" maxLength={500} />
                      <button className="button-primary text-sm" type="submit">Approve</button>
                    </form>
                    <form action="/api/usage-governance/approvals/review" method="POST">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="status" value="DENIED" />
                      <input name="decisionReason" className="input mr-2 text-sm" placeholder="Reason (optional)" maxLength={500} />
                      <button className="rounded-xl border border-red-500/50 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10" type="submit">Deny</button>
                    </form>
                  </div>
                )}

                {request.status !== "PENDING" && request.decisionReason && (
                  <p className="mt-3 text-sm text-slate-400 border-t border-slate-800 pt-3">
                    Review note: {request.decisionReason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
