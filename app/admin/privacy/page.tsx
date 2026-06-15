import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PRIVACY_PREVIEW_GAPS } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export default async function AdminPrivacyPage() {
  await requireAdmin();
  const rows = await db.$queryRaw<Array<{ status: string; count: bigint }>>`
    SELECT "status", COUNT(*)::bigint AS count FROM "PrivacyIncident" GROUP BY "status" ORDER BY "status"
  `;
  return (
    <div>
      <p className="eyebrow">Admin - Internal Preview</p>
      <h1 className="mt-2 text-3xl font-bold">Privacy incident readiness preview</h1>
      <p className="mt-3 text-slate-400">Readiness counts and drafting support only. This is not legal advice, compliance certification, or proof that SLA workflows are complete.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-4">
        {rows.length ? rows.map((row) => <section className="card p-5" key={row.status}><p className="text-sm text-slate-400">{row.status}</p><p className="mt-2 text-2xl font-bold">{Number(row.count)}</p></section>) : <p className="text-slate-500">No privacy incidents recorded.</p>}
      </div>
      <section className="card mt-7 p-5">
        <h2 className="text-lg font-semibold">Privacy preview gap list</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
          {PRIVACY_PREVIEW_GAPS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
