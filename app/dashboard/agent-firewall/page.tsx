import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { AGENT_FIREWALL_PREVIEW_GAPS } from "@/lib/agent-firewall";

export const dynamic = "force-dynamic";

export default async function AgentFirewallPage() {
  const active = await getActiveOrganization();
  if (!active) return <p>No organization.</p>;
  const [tools, logs, approvals] = await Promise.all([
    countTable("AgentTool", active.org.id),
    countTable("ToolCallLog", active.org.id),
    countWhere("ToolApprovalRequest", active.org.id, "PENDING"),
  ]);
  return (
    <div>
      <p className="eyebrow">Agent firewall - Preview</p>
      <h1 className="mt-2 text-3xl font-bold">Tool-call controls and approvals</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Preview scaffold for defensive inspection and approval tracking. It is not runtime agent enforcement yet; production use still requires integration with the agent execution path.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[["Registered tools", tools], ["Tool-call logs", logs], ["Pending approvals", approvals]].map(([label, value]) => (
          <section className="card p-5" key={String(label)}>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold">{String(value)}</p>
          </section>
        ))}
      </div>
      <section className="card mt-7 p-5">
        <h2 className="text-lg font-semibold">Agent firewall preview gap list</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
          {AGENT_FIREWALL_PREVIEW_GAPS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function countTable(table: string, organizationId: string) {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" = $1`, organizationId);
  return Number(rows[0]?.count ?? 0);
}

async function countWhere(table: string, organizationId: string, status: string) {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" = $1 AND "status" = $2`, organizationId, status);
  return Number(rows[0]?.count ?? 0);
}
