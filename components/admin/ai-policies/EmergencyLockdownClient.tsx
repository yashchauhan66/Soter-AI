"use client";

import { useState, useCallback } from "react";
import { Shield, ShieldOff, AlertTriangle, Clock, Ban } from "lucide-react";
import type { Organization } from "@prisma/client";

interface Props {
  organizations: Pick<Organization, "id" | "name">[];
  initialState: {
    organizationId: string | null;
    isLockedDown: boolean;
    lastEnabledAt: string | null;
    lastAdminEmail: string | null;
  };
}

export function EmergencyLockdownClient({ organizations, initialState }: Props) {
  const [isLockedDown, setIsLockedDown] = useState(initialState.isLockedDown);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [organizationId, setOrganizationId] = useState(initialState.organizationId ?? organizations[0]?.id ?? "");

  const toggleLockdown = useCallback(async () => {
    if (!isLockedDown && confirmText !== "LOCKDOWN") return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/emergency-lockdown/${isLockedDown ? "disable" : "enable"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (response.ok) {
        setIsLockedDown(!isLockedDown);
        setConfirmText("");
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [isLockedDown, confirmText, organizationId]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          {isLockedDown ? (
            <ShieldOff className="text-red-400" size={24} />
          ) : (
            <Shield className="text-cyan" size={24} />
          )}
          Emergency AI Lockdown
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Immediately restrict AI data sharing across all deployed extensions.
        </p>
      </div>
      <label className="mb-6 block max-w-md text-sm text-slate-300">
        Organization
        <select className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2" value={organizationId} onChange={async (event) => {
          const next = event.target.value;
          setOrganizationId(next);
          const response = await fetch(`/api/admin/emergency-lockdown?organizationId=${encodeURIComponent(next)}`);
          if (response.ok) {
            const body = await response.json() as { state: { enabled: boolean } };
            setIsLockedDown(body.state.enabled);
          }
        }}>
          {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
        </select>
      </label>

      {/* Status banner */}
      <div className={`mb-6 rounded-lg border p-5 ${isLockedDown ? "border-red-500/50 bg-red-500/10" : "border-slate-800 bg-panel/50"}`}>
        <div className="flex items-center gap-4">
          <div className={`rounded-full p-3 ${isLockedDown ? "bg-red-500/20" : "bg-slate-800"}`}>
            {isLockedDown ? <Ban className="text-red-400" size={28} /> : <Shield className="text-slate-400" size={28} />}
          </div>
          <div>
            <h2 className={`text-xl font-bold ${isLockedDown ? "text-red-300" : "text-slate-300"}`}>
              {isLockedDown ? "EMERGENCY LOCKDOWN IS ACTIVE" : "No active lockdown"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {isLockedDown
                ? "All non-enterprise AI destinations are blocked. File uploads are restricted. Prompt approvals are required for sensitive data."
                : "All extensions are operating under normal policy."}
            </p>
          </div>
        </div>
      </div>

      {/* What lockdown does */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { icon: Ban, label: "Block unknown AI destinations", active: isLockedDown },
          { icon: Ban, label: "Block all AI file uploads", active: isLockedDown },
          { icon: AlertTriangle, label: "Require approval for source code", active: isLockedDown },
          { icon: Shield, label: "Block secrets, customer data, HR, finance, legal data", active: isLockedDown },
          { icon: Shield, label: "Allow only approved enterprise AI destinations", active: isLockedDown },
          { icon: Clock, label: "Push urgent policy version to all extensions", active: isLockedDown },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-lg border p-4 ${
              item.active
                ? "border-red-500/30 bg-red-500/5"
                : "border-slate-800 bg-panel/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon size={18} className={item.active ? "text-red-300" : "text-slate-500"} />
              <span className={`text-sm ${item.active ? "text-red-200" : "text-slate-400"}`}>{item.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Toggle */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-200">
          {isLockedDown ? "Deactivate Emergency Lockdown" : "Activate Emergency Lockdown"}
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          {isLockedDown
            ? "Return extensions to normal policy operation."
            : "This will immediately restrict AI data sharing across all deployed extensions. Type LOCKDOWN to confirm."}
        </p>

        {!isLockedDown && (
          <input
            className="mt-3 w-full max-w-xs rounded-md border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            placeholder='Type "LOCKDOWN" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        )}

        <button
          className={`mt-4 rounded-md px-6 py-3 text-sm font-bold ${
            isLockedDown
              ? "bg-lime text-slate-900 hover:bg-lime/80"
              : confirmText === "LOCKDOWN"
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
          disabled={loading || (!isLockedDown && confirmText !== "LOCKDOWN")}
          onClick={toggleLockdown}
        >
          {loading ? "Processing..." : isLockedDown ? "Deactivate Lockdown" : "Activate Emergency Lockdown"}
        </button>

        {initialState.lastEnabledAt && (
          <p className="mt-4 text-xs text-slate-500">
            Last change: {new Date(initialState.lastEnabledAt).toLocaleString()}
            {initialState.lastAdminEmail && ` by ${initialState.lastAdminEmail}`}
          </p>
        )}
      </div>
    </div>
  );
}
