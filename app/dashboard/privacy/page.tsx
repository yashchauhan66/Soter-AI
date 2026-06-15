import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PRIVACY_PREVIEW_GAPS } from "@/lib/privacy";

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
      <p className="eyebrow">Privacy - Preview</p>
      <h1 className="mt-2 text-3xl font-bold">DPDP readiness workflow</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Preview workflow for data subject requests, consent evidence, processing records, privacy incidents, and breach-notification drafts. This is readiness support, not legal advice or compliance certification.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-4">
        {[["DSRs", dsr], ["Consent records", consents], ["Privacy incidents", incidents], ["Processing records", processing]].map(([label, value]) => <section className="card p-5" key={String(label)}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold">{String(value)}</p></section>)}
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

async function countTable(table: string, organizationId: string) {
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" = $1`, organizationId);
  return Number(rows[0]?.count ?? 0);
}
