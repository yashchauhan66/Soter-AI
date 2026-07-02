"use client";

import { useState, useCallback } from "react";
import { KeyRound, Shield, ShieldOff, Copy, Check, AlertCircle, Filter } from "lucide-react";

interface Token {
  id: string;
  organizationId: string;
  employeeEmail: string | null;
  department: string | null;
  role: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy?: string | null;
  createdByAdminId?: string | null;
  status?: string;
}

interface Props {
  organizations: Array<{ id: string; name: string }>;
  initialTokens: Token[];
}

function tokenStatus(token: Token): string {
  if (token.revokedAt) return "revoked";
  if (new Date(token.expiresAt).getTime() <= Date.now()) return "expired";
  if (token.usedCount >= token.maxUses) return "used_up";
  return "active";
}

const STATUS_STYLES: Record<string, string> = {
  active: "border-lime/30 bg-lime/10 text-lime",
  revoked: "border-red-500/30 bg-red-500/10 text-red-400",
  expired: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  used_up: "border-slate-600/30 bg-slate-600/10 text-slate-400",
};

export function EnrollmentTokensClient({ organizations, initialTokens }: Props) {
  const [tokens, setTokens] = useState(initialTokens);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newMaxUses, setNewMaxUses] = useState(1);
  const [newExpiresHours, setNewExpiresHours] = useState(720);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDept, setFilterDept] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterCreatedBy, setFilterCreatedBy] = useState<string>("");

  const departments = [...new Set(tokens.map((t) => t.department).filter(Boolean))] as string[];
  const roles = [...new Set(tokens.map((t) => t.role).filter(Boolean))] as string[];
  const creators = [...new Set(tokens.map((t) => t.createdBy).filter(Boolean))] as string[];

  const filteredTokens = tokens.filter((t) => {
    if (filterStatus && tokenStatus(t) !== filterStatus) return false;
    if (filterDept && t.department !== filterDept) return false;
    if (filterRole && t.role !== filterRole) return false;
    if (filterCreatedBy && t.createdBy !== filterCreatedBy) return false;
    return true;
  });

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/extension-enrollments?organizationId=${encodeURIComponent(organizationId)}`);
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens ?? []);
      }
    } catch { /* ignore */ }
  }, [organizationId]);

  const createToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/extension-enrollment-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          employeeEmail: newEmail || undefined,
          department: newDept || undefined,
          role: newRole || undefined,
          maxUses: newMaxUses,
          expiresInHours: newExpiresHours,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreatedToken(data.rawToken);
        if (data.token) setTokens((current) => [data.token, ...current]);
        setShowCreate(false);
        setNewEmail("");
        setNewDept("");
        setNewRole("");
      } else {
        setError(data.message ?? "Failed to create token");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [organizationId, newEmail, newDept, newRole, newMaxUses, newExpiresHours, fetchTokens]);

  const revokeToken = useCallback(async (tokenId: string) => {
    if (!confirm("Revoke this enrollment token? Devices using it will not be able to enroll.")) return;
    try {
      const res = await fetch(`/api/admin/extension-enrollment-token/${encodeURIComponent(tokenId)}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, reason: "Revoked from extension enrollment admin page" }),
      });
      if (res.ok) await fetchTokens();
    } catch { /* ignore */ }
  }, [organizationId, fetchTokens]);

  const copyToken = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div>
      {createdToken && (
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-300">
            <AlertCircle size={16} /> Copy this enrollment token now — it will not be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-slate-950 p-3 text-xs text-slate-200">{createdToken}</code>
            <button className="rounded bg-slate-800 p-2 text-slate-300 hover:bg-slate-700" onClick={() => copyToken(createdToken, "new")}>
              {copiedId === "new" ? <Check size={14} className="text-lime" /> : <Copy size={14} />}
            </button>
          </div>
          <button className="mt-2 text-xs text-slate-400 underline" onClick={() => setCreatedToken(null)}>Dismiss</button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      <label className="mb-4 block max-w-md text-sm text-slate-300">
        Organization
        <select className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2" value={organizationId} onChange={(e) => { setOrganizationId(e.target.value); }}>
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-slate-500" />
        <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
          <option value="used_up">Used up</option>
        </select>
        {departments.length > 0 && (
          <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {roles.length > 0 && (
          <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">All roles</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {creators.length > 0 && (
          <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300" value={filterCreatedBy} onChange={(e) => setFilterCreatedBy(e.target.value)}>
            <option value="">All creators</option>
            {creators.map((creator) => <option key={creator} value={creator}>{creator}</option>)}
          </select>
        )}
      </div>

      <div className="mb-6 flex items-center gap-3">
        <button className="button-primary flex items-center gap-2" onClick={() => setShowCreate(!showCreate)}>
          <KeyRound size={14} /> Create Enrollment Token
        </button>
        <button className="text-sm text-slate-400 underline" onClick={fetchTokens}>Refresh</button>
      </div>

      {showCreate && (
        <div className="card mb-6 p-5">
          <h3 className="font-semibold">New Enrollment Token</h3>
          <input className="input mt-3" placeholder="Employee email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <input className="input mt-2" placeholder="Department (optional)" value={newDept} onChange={(e) => setNewDept(e.target.value)} />
          <input className="input mt-2" placeholder="Role (optional)" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
          <div className="mt-2 flex gap-4">
            <label className="text-sm text-slate-400">
              Max uses
              <input type="number" className="input mt-1 w-24" min={1} max={100} value={newMaxUses} onChange={(e) => setNewMaxUses(parseInt(e.target.value, 10) || 1)} />
            </label>
            <label className="text-sm text-slate-400">
              Expires in hours
              <input type="number" className="input mt-1 w-32" min={1} max={8760} value={newExpiresHours} onChange={(e) => setNewExpiresHours(parseInt(e.target.value, 10) || 720)} />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="button-primary" disabled={loading} onClick={createToken}>{loading ? "Creating..." : "Create Token"}</button>
            <button className="text-sm text-slate-400" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Token list */}
      <div className="space-y-2">
        {filteredTokens.length === 0 && (
          <div className="card p-6 text-center text-slate-500">No enrollment tokens found.</div>
        )}
        {filteredTokens.map((token) => {
          const status = tokenStatus(token);
          return (
            <div key={token.id} className="card flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <Shield size={18} className={status === "active" ? "text-lime" : "text-slate-500"} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200">{token.employeeEmail ?? "No email"}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[status]}`}>{status}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    <span>Created by: {token.createdBy ?? token.createdByAdminId ?? "unknown"}</span>
                    <span> | Created: {new Date(token.createdAt).toLocaleDateString()}</span>
                    {token.department && <span> | Dept: {token.department}</span>}
                    {token.role && <span> | Role: {token.role}</span>}
                    <span> | Used: {token.usedCount}/{token.maxUses}</span>
                    <span> | Expires: {new Date(token.expiresAt).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {status === "active" && (
                  <button className="rounded bg-red-900/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/60 flex items-center gap-1" onClick={() => revokeToken(token.id)}>
                    <ShieldOff size={12} /> Revoke
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
