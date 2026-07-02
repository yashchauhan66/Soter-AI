import { db } from "@/lib/db";
import { Activity, Wifi, WifiOff, Smartphone, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExtensionHealthPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, name: true },
  });

  // Get device agents (extensions)
  const deviceAgents = await db.deviceAgent.findMany({
    orderBy: { lastHeartbeatAt: "desc" },
    take: 200,
    include: { organization: { select: { name: true } } },
  });

  const now = new Date();
  const activeThreshold = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes

  const activeAgents = deviceAgents.filter((a) => a.lastHeartbeatAt && a.lastHeartbeatAt > activeThreshold);
  const inactiveAgents = deviceAgents.filter((a) => !a.lastHeartbeatAt || a.lastHeartbeatAt <= activeThreshold);

  const totalByVersion = deviceAgents.reduce<Record<string, number>>((acc, a) => {
    acc[a.version] = (acc[a.version] || 0) + 1;
    return acc;
  }, {});

  const totalByBrowser = deviceAgents.reduce<Record<string, number>>((acc, a) => {
    acc[a.platform] = (acc[a.platform] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <Activity className="text-cyan" size={24} />
          Extension Health
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {deviceAgents.length} total extensions · {activeAgents.length} active · {inactiveAgents.length} inactive
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Wifi className="text-lime" size={18} />
            <span className="text-sm text-slate-400">Active</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-lime">{activeAgents.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <WifiOff className="text-amber-400" size={18} />
            <span className="text-sm text-slate-400">Inactive</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-300">{inactiveAgents.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Smartphone className="text-cyan" size={18} />
            <span className="text-sm text-slate-400">Versions</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-cyan">{Object.keys(totalByVersion).length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Shield className="text-cyan" size={18} />
            <span className="text-sm text-slate-400">Organizations</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-cyan">{deviceAgents.length}</p>
        </div>
      </div>

      {/* Version distribution */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Version Distribution</h2>
          <div className="space-y-2">
            {Object.entries(totalByVersion)
              .sort(([, a], [, b]) => b - a)
              .map(([version, count]) => (
                <div key={version} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{version}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-cyan" style={{ width: `${(count / deviceAgents.length) * 100}%` }} />
                    <span className="w-8 text-right text-slate-500">{count}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Browser / Platform Distribution</h2>
          <div className="space-y-2">
            {Object.entries(totalByBrowser)
              .sort(([, a], [, b]) => b - a)
              .map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{platform}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-cyan" style={{ width: `${(count / deviceAgents.length) * 100}%` }} />
                    <span className="w-8 text-right text-slate-500">{count}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Extension list */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Organization</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Policy</th>
              <th className="px-4 py-3">Last Heartbeat</th>
              <th className="px-4 py-3">Destination</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {deviceAgents.map((agent) => {
              const isActive = agent.lastHeartbeatAt && agent.lastHeartbeatAt > activeThreshold;
              return (
                <tr key={agent.id}>
                  <td className="px-4 py-3 font-medium text-slate-200">{agent.employeeId ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{agent.organization?.name ?? agent.organizationId}</td>
                  <td className="px-4 py-3 text-slate-400">{agent.version}</td>
                  <td className="px-4 py-3 text-slate-400">{agent.platform}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 text-xs font-bold ${isActive ? "text-lime" : "text-amber-400"}`}>
                      <span className={`inline-block h-2 w-2 rounded-full ${isActive ? "bg-lime" : "bg-amber-400"}`} />
                      {isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{agent.policyVersion ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {agent.lastHeartbeatAt ? new Date(agent.lastHeartbeatAt).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{agent.activeDestination ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
