"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MonitorSmartphone } from "lucide-react";
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

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        <MonitorSmartphone size={18} className="text-cyan" />
        <h2 className="text-lg font-semibold">Enrolled devices</h2>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Every browser connected to this organization. Revoke a device to immediately cut off its extension.
      </p>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-4">User</th>
              <th className="py-2 pr-4">Department</th>
              <th className="py-2 pr-4">Platform</th>
              <th className="py-2 pr-4">Version</th>
              <th className="py-2 pr-4">Last seen</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7} message="No devices enrolled yet. Share an enrollment code to get started." />
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-b border-slate-900 text-slate-300">
                  <td className="py-2 pr-4">{d.employeeEmail ?? "—"}</td>
                  <td className="py-2 pr-4">{d.department ?? "—"}</td>
                  <td className="py-2 pr-4">{d.platform}</td>
                  <td className="py-2 pr-4 text-slate-400">{d.version}</td>
                  <td className="py-2 pr-4 text-slate-400">{relativeTime(d.lastHeartbeatAt)}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge value={d.status === "active" ? "ACTIVE" : d.status.toUpperCase()} />
                  </td>
                  <td className="py-2 text-right">
                    {d.status === "active" && (
                      <button onClick={() => revoke(d.id)} className="text-xs text-red-300 hover:underline">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
