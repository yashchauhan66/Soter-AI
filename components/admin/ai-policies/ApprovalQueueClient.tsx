"use client";

import { useState, useCallback } from "react";
import { Shield, CheckCircle2, XCircle, AlertTriangle, Search, Filter, Clock } from "lucide-react";
import type { Organization } from "@prisma/client";

interface ApprovalRequest {
  id: string;
  organizationId: string;
  employeeId: string;
  domain: string;
  destination: string;
  detectedDataTypes: string[];
  severity: string;
  riskScore: number;
  redactedPreview: string;
  justification: string;
  status: "pending" | "approved" | "rejected" | "redacted";
  createdAt: string;
}

interface ApprovalAction {
  id: string;
  action: string;
  adminEmail: string;
  reason: string;
  createdAt: string;
  targetId: string;
}

interface Props {
  organizations: Pick<Organization, "id" | "name">[];
  initialApprovals: ApprovalRequest[];
  initialActions: ApprovalAction[];
}

type ApprovalFilter = "all" | "pending" | "approved" | "rejected";

export function ApprovalQueueClient({ organizations, initialApprovals, initialActions }: Props) {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [actions, setActions] = useState(initialActions);
  const [filter, setFilter] = useState<ApprovalFilter>("pending");
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [loading, setLoading] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState("");

  const filteredApprovals = approvals.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (selectedOrg !== "all" && a.organizationId !== selectedOrg) return false;
    if (search && !a.employeeId.toLowerCase().includes(search.toLowerCase()) && !a.domain.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleAction = useCallback(async (id: string, action: "approve" | "reject" | "redact") => {
    setLoading(id);
    try {
      const response = await fetch(`/api/admin/approvals/${id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: actionNote || `Admin ${action}ed request` }),
      });
      if (response.ok) {
        setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "redacted" } : a)));
        setActions((prev) => [{ id: crypto.randomUUID(), action: `extension_approval_${action}ed`, adminEmail: "current-admin", reason: actionNote, createdAt: new Date().toISOString(), targetId: id }, ...prev]);
        setActionNote("");
      }
    } catch {
      // Handle error silently
    } finally {
      setLoading(null);
    }
  }, [actionNote]);

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Approval Queue</h1>
          <p className="mt-1 text-sm text-slate-400">
            {pendingCount} pending {pendingCount === 1 ? "request" : "requests"} requiring admin review
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-panel/50 p-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-500" />
          <select
            className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
            value={filter}
            onChange={(e) => setFilter(e.target.value as ApprovalFilter)}
          >
            <option value="pending">Pending</option>
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Search size={16} className="text-slate-500" />
          <input
            className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            placeholder="Search employee or domain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
        >
          <option value="all">All organizations</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      {/* Approval cards */}
      <div className="space-y-4">
        {filteredApprovals.length === 0 ? (
          <div className="card flex items-center gap-3 p-6 text-slate-400">
            <Shield size={20} className="text-cyan" />
            No approval requests match the current filter.
          </div>
        ) : (
          filteredApprovals.map((approval) => (
            <div
              key={approval.id}
              className={`card overflow-hidden border-l-4 ${
                approval.severity === "critical" || approval.severity === "high"
                  ? "border-l-red-500"
                  : approval.severity === "medium"
                  ? "border-l-amber-500"
                  : "border-l-cyan-500"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-200">{approval.employeeId}</span>
                    <span className="text-sm text-slate-500">at</span>
                    <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">{approval.destination}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {approval.detectedDataTypes.map((type) => (
                      <span key={type} className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                        {type}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span>Risk: {approval.riskScore}</span>
                    <span>Severity: {approval.severity}</span>
                    <span>Domain: {approval.domain}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(approval.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {approval.justification && (
                    <p className="text-sm italic text-slate-500">Justification: {approval.justification}</p>
                  )}
                  {approval.redactedPreview && (
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer text-cyan">Show redacted preview</summary>
                      <pre className="mt-2 rounded border border-slate-800 bg-slate-950 p-3 text-slate-400">{approval.redactedPreview}</pre>
                    </details>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {approval.status === "pending" ? (
                    <>
                      <input
                        className="w-40 rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-300 placeholder:text-slate-600"
                        placeholder="Admin note (optional)"
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                      />
                      <button
                        className="rounded-md bg-lime px-3 py-2 text-xs font-bold text-slate-900 hover:bg-lime/80 disabled:opacity-50"
                        disabled={loading === approval.id}
                        onClick={() => handleAction(approval.id, "approve")}
                      >
                        <CheckCircle2 size={14} className="inline" /> Approve
                      </button>
                      <button
                        className="rounded-md bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
                        disabled={loading === approval.id}
                        onClick={() => handleAction(approval.id, "reject")}
                      >
                        <XCircle size={14} className="inline" /> Reject
                      </button>
                      <button
                        className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                        disabled={loading === approval.id}
                        onClick={() => handleAction(approval.id, "redact")}
                      >
                        <AlertTriangle size={14} className="inline" /> Require Redaction
                      </button>
                    </>
                  ) : (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        approval.status === "approved"
                          ? "bg-lime/10 text-lime"
                          : approval.status === "rejected"
                          ? "bg-red-500/10 text-red-300"
                          : "bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {approval.status.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Audit trail */}
      {actions.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Shield size={18} className="text-cyan" />
            Approval Audit Trail
          </h2>
          <div className="space-y-2">
            {actions.map((action) => (
              <div key={action.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-panel/30 px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{action.adminEmail}</span>
                  <span className="text-slate-500">-</span>
                  <span className="text-slate-300">{action.action.replace(/_/g, " ")}</span>
                  {action.reason && <span className="text-slate-500">({action.reason})</span>}
                </div>
                <span className="text-xs text-slate-600">{new Date(action.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
