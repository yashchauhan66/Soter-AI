"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, RefreshCw, ShieldOff } from "lucide-react";
import type { Organization } from "@prisma/client";

type TokenStatus = "active" | "expired" | "revoked" | "used_up";

interface EnrollmentToken {
  id: string;
  organizationId: string;
  employeeEmail: string | null;
  department: string | null;
  role: string | null;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  status: TokenStatus;
}

export function ExtensionEnrollmentsClient({ organizations }: { organizations: Pick<Organization, "id" | "name">[] }) {
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [tokens, setTokens] = useState<EnrollmentToken[]>([]);
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeEmail: "", department: "", role: "", maxUses: 1, expiresInDays: 30 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    (async () => {
      const params = new URLSearchParams({ organizationId });
      if (status !== "all") params.set("status", status);
      if (department) params.set("department", department);
      if (role) params.set("role", role);
      const response = await fetch(`/api/admin/extension-enrollment-token?${params}`, { signal: controller.signal });
      if (response.ok) setTokens(((await response.json()) as { tokens: EnrollmentToken[] }).tokens);
    })();
    return () => controller.abort();
  }, [organizationId, status, department, role]);

  const departments = useMemo(() => Array.from(new Set(tokens.map((token) => token.department).filter(Boolean))) as string[], [tokens]);
  const roles = useMemo(() => Array.from(new Set(tokens.map((token) => token.role).filter(Boolean))) as string[], [tokens]);

  const createToken = async () => {
    setLoading(true);
    setCreatedToken(null);
    try {
      const response = await fetch("/api/admin/extension-enrollment-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          employeeEmail: form.employeeEmail || undefined,
          department: form.department || undefined,
          role: form.role || undefined,
          maxUses: form.maxUses,
          expiresInDays: form.expiresInDays,
        }),
      });
      if (response.ok) {
        const body = await response.json() as { enrollmentCode: string };
        setCreatedToken(body.enrollmentCode);
        await refreshTokens();
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshTokens = async () => {
    if (!organizationId) return;
    const params = new URLSearchParams({ organizationId });
    if (status !== "all") params.set("status", status);
    if (department) params.set("department", department);
    if (role) params.set("role", role);
    const response = await fetch(`/api/admin/extension-enrollment-token?${params}`);
    if (response.ok) setTokens(((await response.json()) as { tokens: EnrollmentToken[] }).tokens);
  };

  const revokeToken = async (id: string) => {
    const response = await fetch(`/api/admin/extension-enrollment-token/${id}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Revoked from enrollment UI" }),
    });
    if (response.ok) await refreshTokens();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Extension Enrollments</h1>
          <p className="mt-1 text-sm text-slate-400">Create and revoke browser extension enrollment tokens without exposing raw tokens after creation.</p>
        </div>
        <button className="rounded-md border border-slate-700 p-2 text-slate-300 hover:border-cyan-500/60" onClick={refreshTokens} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-lg border border-slate-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Create Token</h2>
          <div className="grid gap-3">
            <select className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
              {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Employee email" value={form.employeeEmail} onChange={(event) => setForm({ ...form, employeeEmail: event.target.value })} />
            <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
            <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" type="number" min={1} max={1000} value={form.maxUses} onChange={(event) => setForm({ ...form, maxUses: Number(event.target.value) })} />
              <input className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" type="number" min={1} max={365} value={form.expiresInDays} onChange={(event) => setForm({ ...form, expiresInDays: Number(event.target.value) })} />
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50" disabled={loading || !organizationId} onClick={createToken}>
              <Plus size={16} /> Create token
            </button>
            {createdToken && (
              <div className="rounded-md border border-lime/40 bg-lime/10 p-3 text-sm text-lime">
                <div className="mb-2 font-semibold">Copy now. It will not be shown again.</div>
                <button className="inline-flex max-w-full items-center gap-2 rounded border border-lime/50 px-2 py-1 text-left font-mono text-xs" onClick={() => navigator.clipboard.writeText(createdToken)}>
                  <Copy size={14} /><span className="truncate">{createdToken}</span>
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Filters</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
              <option value="used_up">Used up</option>
            </select>
            <select className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="">All departments</option>
              {departments.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="">All roles</option>
              {roles.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <button className="mt-3 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300" onClick={refreshTokens}>Apply filters</button>
        </section>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-3">Email</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Usage</th><th className="px-3 py-3">Expires</th><th className="px-3 py-3">Created</th><th className="px-3 py-3">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tokens.map((token) => (
              <tr key={token.id}>
                <td className="px-3 py-3 text-slate-200">{token.employeeEmail ?? "Any employee"}</td>
                <td className="px-3 py-3 text-slate-400">{token.department ?? "-"}</td>
                <td className="px-3 py-3 text-slate-400">{token.role ?? "-"}</td>
                <td className="px-3 py-3 font-semibold">{token.status}</td>
                <td className="px-3 py-3 text-slate-400">{token.usedCount}/{token.maxUses}</td>
                <td className="px-3 py-3 text-slate-400">{new Date(token.expiresAt).toLocaleDateString()}</td>
                <td className="px-3 py-3 text-slate-500">{new Date(token.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-3">
                  <button className="inline-flex items-center gap-2 rounded border border-red-500/40 px-2 py-1 text-xs font-bold text-red-300 disabled:opacity-40" disabled={token.status === "revoked"} onClick={() => revokeToken(token.id)}>
                    <ShieldOff size={14} /> Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
