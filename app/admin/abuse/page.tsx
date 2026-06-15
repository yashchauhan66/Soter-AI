import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ABUSE_PREVIEW_GAPS } from "@/lib/abuse";

export const dynamic = "force-dynamic";

export default async function AbusePage() {
  await requireAdmin();
  const [signals, anomalies, throttles] = await Promise.all([countAll("AbuseSignal"), countAll("UsageAnomaly"), countAll("ThrottleEvent")]);
  return (
    <div>
      <p className="eyebrow">Admin - Internal Preview</p>
      <h1 className="mt-2 text-3xl font-bold">Abuse and cost controls preview</h1>
      <p className="mt-3 text-slate-400">Internal Preview for abuse signals, cost anomalies, spike detection, and throttling evidence. Route-wide production enforcement is tracked separately.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[["Abuse signals", signals], ["Usage anomalies", anomalies], ["Throttle events", throttles]].map(([label, value]) => <section className="card p-5" key={String(label)}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{String(value)}</p></section>)}
      </div>
      <section className="card mt-7 p-5">
        <h2 className="text-lg font-semibold">Abuse controls preview gap list</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
          {ABUSE_PREVIEW_GAPS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function countAll(table: string) {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}"`);
  return Number(rows[0]?.count ?? 0);
}
