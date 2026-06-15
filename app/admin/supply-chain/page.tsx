import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminSupplyChainPage() {
  await requireAdmin();
  const rows = await db.$queryRaw<Array<{ severity: string; count: bigint }>>`
    SELECT "severity", COUNT(*)::bigint AS count
    FROM "SupplyChainRiskFinding"
    GROUP BY "severity"
    ORDER BY "severity"
  `;
  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-3xl font-bold">Supply chain risk findings</h1>
      <div className="mt-7 grid gap-4 sm:grid-cols-4">
        {rows.length ? rows.map((row) => (
          <section className="card p-5" key={row.severity}>
            <p className="text-sm text-slate-400">{row.severity}</p>
            <p className="mt-2 text-2xl font-bold">{Number(row.count)}</p>
          </section>
        )) : <p className="text-slate-500">No findings recorded.</p>}
      </div>
    </div>
  );
}
