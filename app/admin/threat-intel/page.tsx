import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { THREAT_INTEL_PREVIEW_GAPS } from "@/lib/threat-intel";

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
      <p className="eyebrow">Admin - Internal Preview</p>
      <h1 className="mt-2 text-3xl font-bold">Threat intelligence pipeline preview</h1>
      <p className="mt-3 text-slate-400">Internal Preview for rule validation and lifecycle planning. Remote feeds, approval workflow, promotion, and rollback require authorized setup before production use.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[["Sources", sources], ["Patterns", patterns], ["Rule versions", ruleVersions]].map(([label, value]) => <section className="card p-5" key={String(label)}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{String(value)}</p></section>)}
      </div>
      <section className="card mt-7 p-5">
        <h2 className="text-lg font-semibold">Threat intel preview gap list</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
          {THREAT_INTEL_PREVIEW_GAPS.map((gap) => (
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
