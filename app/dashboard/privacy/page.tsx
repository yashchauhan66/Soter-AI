import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PrivacyDashboardPage() {
  const active = await getActiveOrganization();
  if (!active) return <p>No organization.</p>;
  const [dsr, consents, incidents, processing] = await Promise.all([
    countTable("DataSubjectRequest", active.org.id),
    countTable("ConsentRecord", active.org.id),
    countTable("PrivacyIncident", active.org.id),
    countTable("DataProcessingRecord", active.org.id),
  ]);
  return (
    <div>
      <p className="eyebrow">Privacy</p>
      <h1 className="mt-2 text-3xl font-bold">DPDP readiness workflow</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Track data subject requests, consent evidence, processing records, privacy incidents, and breach-notification drafts. This is readiness support, not legal certification.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-4">
        {[["DSRs", dsr], ["Consent records", consents], ["Privacy incidents", incidents], ["Processing records", processing]].map(([label, value]) => <section className="card p-5" key={String(label)}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{String(value)}</p></section>)}
      </div>
    </div>
  );
}

async function countTable(table: string, organizationId: string) {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" = $1`, organizationId);
  return Number(rows[0]?.count ?? 0);
}
