import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPrivacyPage() {
  await requireAdmin();
  const rows = await db.$queryRaw<Array<{ status: string; count: bigint }>>`
    SELECT "status", COUNT(*)::bigint AS count FROM "PrivacyIncident" GROUP BY "status" ORDER BY "status"
  `;
  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-3xl font-bold">Privacy incident readiness</h1>
      <div className="mt-7 grid gap-4 sm:grid-cols-4">
        {rows.length ? rows.map((row) => <section className="card p-5" key={row.status}><p className="text-sm text-slate-400">{row.status}</p><p className="mt-2 text-2xl font-bold">{Number(row.count)}</p></section>) : <p className="text-slate-500">No privacy incidents recorded.</p>}
      </div>
    </div>
  );
}
