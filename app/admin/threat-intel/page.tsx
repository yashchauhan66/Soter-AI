import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ThreatIntelPage() {
  await requireAdmin();
  const [sources, patterns, ruleVersions] = await Promise.all([
    countAll("ThreatIntelSource"),
    countAll("ThreatPattern"),
    countAll("DetectorRuleVersion"),
  ]);
  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-3xl font-bold">Threat intelligence pipeline</h1>
      <p className="mt-3 text-slate-400">Remote rule packs must be validated and approved before activation. New rules should run in shadow mode before promotion.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[["Sources", sources], ["Patterns", patterns], ["Rule versions", ruleVersions]].map(([label, value]) => <section className="card p-5" key={String(label)}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{String(value)}</p></section>)}
      </div>
    </div>
  );
}

async function countAll(table: string) {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}"`);
  return Number(rows[0]?.count ?? 0);
}
