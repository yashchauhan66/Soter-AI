"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MonitorSmartphone, Shield, AlertTriangle } from "lucide-react";
import { StatusBadge, EmptyRow } from "@/components/dashboard/MetricCard";

interface DeviceRow {
  id: string;
  employeeEmail: string | null;
  department: string | null;
  role: string | null;
  platform: string;
  version: string;
  status: string;
  policyVersion: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function checkCompliance(iso: string | null): { compliant: boolean; label: string; class: string } {
  if (!iso) {
    return { compliant: false, label: "NON-COMPLIANT (No Heartbeat)", class: "text-red-400 bg-red-950/40 border-red-900" };
  }
  const diff = Date.now() - new Date(iso).getTime();
  const fifteenMins = 15 * 60000;
  if (diff < fifteenMins) {
    return { compliant: true, label: "COMPLIANT", class: "text-emerald-400 bg-emerald-950/40 border-emerald-900" };
  }
  return { compliant: false, label: "NON-COMPLIANT (Offline/Missing)", class: "text-yellow-400 bg-yellow-950/40 border-yellow-900" };
}

export function ExtensionDevicesPanel({
  organizationId,
  devices,
}: {
  organizationId: string;
  devices: DeviceRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<DeviceRow[]>(devices);
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string) {
    try {
      const res = await fetch(`/api/dashboard/extension/devices/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error();
      setRows((prev) => prev.map((d) => (d.id === id ? { ...d, status: "revoked" } : d)));
      router.refresh();
    } catch {
      setError("Could not revoke that device.");
    }
  }

  // Calculate compliance statistics
  const activeDevices = rows.filter(d => d.status === "active");
  const compliantCount = activeDevices.filter(d => checkCompliance(d.lastHeartbeatAt).compliant).length;
  const totalActive = activeDevices.length;
  const complianceRate = totalActive > 0 ? Math.round((compliantCount / totalActive) * 100) : 100;

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MonitorSmartphone size={18} className="text-cyan" />
            <h2 className="text-lg font-semibold">Enrolled devices</h2>
          </div>
          <p className="mt-1 text-sm text-slate-200">
            Every browser connected to this organization. Revoke a device to immediately cut off its extension.
          </p>
        </div>

        {/* Compliance Seat Counter Widget */}
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          {complianceRate >= 90 ? (
            <Shield className="text-emerald-500" size={24} />
          ) : (
            <AlertTriangle className="text-yellow-500" size={24} />
          )}
          <div>
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Protected Seats</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-200">{complianceRate}%</span>
              <span className="text-xs text-slate-200">({compliantCount}/{totalActive} compliant)</span>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-300">
              <th className="py-2 pr-4">User</th>
              <th className="py-2 pr-4">Department</th>
              <th className="py-2 pr-4">Platform</th>
              <th className="py-2 pr-4">Version</th>
              <th className="py-2 pr-4">Policy</th>
              <th className="py-2 pr-4">Last seen</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Security Compliance</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={9} message="No devices enrolled yet. Share an enrollment code to get started." />
            ) : (
              rows.map((d) => {
                const comp = checkCompliance(d.lastHeartbeatAt);
                return (
                  <tr key={d.id} className="border-b border-slate-900 text-slate-300">
                    <td className="py-2 pr-4">{d.employeeEmail ?? "—"}</td>
                    <td className="py-2 pr-4">{d.department ?? "—"}</td>
                    <td className="py-2 pr-4">{d.platform}</td>
                    <td className="py-2 pr-4 text-slate-200">{d.version}</td>
                    <td className="py-2 pr-4 text-slate-200">{d.policyVersion ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-200">{relativeTime(d.lastHeartbeatAt)}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge value={d.status === "active" ? "ACTIVE" : d.status.toUpperCase()} />
                    </td>
                    <td className="py-2 pr-4">
                      {d.status === "active" ? (
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${comp.class}`}>
                          {comp.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {d.status === "active" && (
                        <button onClick={() => revoke(d.id)} className="text-xs text-red-300 hover:underline">
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
