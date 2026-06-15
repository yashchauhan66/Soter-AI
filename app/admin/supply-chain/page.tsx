import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { AI_BOM_PREVIEW_GAPS } from "@/lib/supply-chain";

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
      <p className="eyebrow">Admin - Internal Preview</p>
      <h1 className="mt-2 text-3xl font-bold">Supply chain risk findings preview</h1>
      <p className="mt-3 text-slate-400">Internal Preview counts for AI supply-chain findings. Complete AI BOM lifecycle, review, and export workflows are tracked separately.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-4">
        {rows.length ? rows.map((row) => (
          <section className="card p-5" key={row.severity}>
            <p className="text-sm text-slate-400">{row.severity}</p>
            <p className="mt-2 text-2xl font-bold">{Number(row.count)}</p>
          </section>
        )) : <p className="text-slate-500">No findings recorded.</p>}
      </div>
      <section className="card mt-7 p-5">
        <h2 className="text-lg font-semibold">AI BOM preview gap list</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
          {AI_BOM_PREVIEW_GAPS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
