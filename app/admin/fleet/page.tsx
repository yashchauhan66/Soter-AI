import { buildFleetInventory } from "@/lib/fleet-inventory";
import { getCurrentProject } from "@/lib/auth";

export const dynamic = "force-dynamic";

const RISK_STYLE: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-300",
  LOW: "bg-green-100 text-green-800 border-green-300",
};

const KIND_LABEL: Record<string, string> = {
  provider: "AI Provider",
  "mcp-server": "MCP Server",
  sdk: "SDK",
  tool: "Tool",
  model: "Model",
};

export default async function FleetPage() {
  const project = await getCurrentProject();
  const organizationId = project?.organizationId ?? null;

  if (!organizationId) {
    return (
      <main className="mx-auto max-w-6xl p-8">
        <h1 className="text-2xl font-bold mb-2">Fleet Inventory</h1>
        <p className="text-sm text-muted-foreground">No organization context on this session.</p>
      </main>
    );
  }

  const inv = await buildFleetInventory(organizationId);

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Fleet Inventory</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estate-wide view of AI assets discovered by Shadow-AI across your organization.
          Generated {new Date(inv.generatedAt).toLocaleString()}.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((r) => (
          <div key={r} className={`rounded-lg border p-4 ${RISK_STYLE[r]}`}>
            <div className="text-2xl font-bold">{inv.byRisk[r]}</div>
            <div className="text-xs font-medium">{r}</div>
          </div>
        ))}
        <div className="rounded-lg border p-4 bg-slate-50">
          <div className="text-2xl font-bold">{inv.totalAssets}</div>
          <div className="text-xs font-medium text-muted-foreground">Total assets</div>
        </div>
      </section>

      <section className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-3 font-semibold">Asset</th>
              <th className="text-left p-3 font-semibold">Type</th>
              <th className="text-left p-3 font-semibold">Risk</th>
              <th className="text-left p-3 font-semibold">Policy</th>
              <th className="text-left p-3 font-semibold">Seen</th>
              <th className="text-left p-3 font-semibold">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {inv.entries.map((e) => (
              <tr key={e.fingerprint} className="border-b last:border-0 hover:bg-slate-50">
                <td className="p-3 font-medium">{e.displayName}</td>
                <td className="p-3 text-muted-foreground">{KIND_LABEL[e.kind] ?? e.kind}</td>
                <td className="p-3">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${RISK_STYLE[e.risk]}`}>
                    {e.risk}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">{e.policyState}</td>
                <td className="p-3 text-muted-foreground">{e.seenCount}</td>
                <td className="p-3 text-muted-foreground">
                  {e.lastSeenAt ? new Date(e.lastSeenAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {inv.entries.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No assets discovered yet. Run a Shadow-AI scan to populate the estate view.
          </div>
        )}
      </section>
    </main>
  );
}
