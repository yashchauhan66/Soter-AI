import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

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
      <p className="eyebrow">Agent firewall</p>
      <h1 className="mt-2 text-3xl font-bold">Tool-call controls and approvals</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Unknown tools are denied by default. High-risk payment, email, database, export, permission, and external write actions require human review or are blocked.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[["Registered tools", tools], ["Tool-call logs", logs], ["Pending approvals", approvals]].map(([label, value]) => (
          <section className="card p-5" key={String(label)}>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold">{String(value)}</p>
          </section>
        ))}
      </div>
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
