import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AbusePage() {
  await requireAdmin();
  const [signals, anomalies, throttles] = await Promise.all([countAll("AbuseSignal"), countAll("UsageAnomaly"), countAll("ThrottleEvent")]);
  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-3xl font-bold">Production abuse prevention</h1>
      <p className="mt-3 text-slate-400">Review signup abuse, API key abuse, cost anomalies, spike detection, and auto-throttle events.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[["Abuse signals", signals], ["Usage anomalies", anomalies], ["Throttle events", throttles]].map(([label, value]) => <section className="card p-5" key={String(label)}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{String(value)}</p></section>)}
      </div>
    </div>
  );
}

async function countAll(table: string) {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}"`);
  return Number(rows[0]?.count ?? 0);
}
