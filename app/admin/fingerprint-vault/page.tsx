import { Database, Fingerprint, Search } from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const selectClass = "h-9 rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100 outline-none focus:border-cyan";

function pick(params: SearchParams, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
}

export default async function FingerprintVaultPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const category = pick(params, "category").toLowerCase();
  const sensitivity = pick(params, "sensitivity").toLowerCase();
  const department = pick(params, "department").toLowerCase();
  const status = pick(params, "status").toLowerCase(); // "enabled" | "disabled" | ""

  let organization: { id: string; name: string } | null = null;
  let sets: Array<Record<string, unknown>> = [];
  let loadError: string | null = null;
  try {
    organization = await db.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
    sets = organization ? await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT s."id", s."name", s."category"::text, s."sensitivity"::text, s."ownerDepartment", s."action"::text,
             s."enabled", s."storageMode"::text, s."sourceType"::text, s."lastMatchedAt", s."createdAt",
             COUNT(c."id")::int AS "fingerprintCount"
      FROM "CompanyFingerprintSet" s
      LEFT JOIN "CompanyFingerprintChunk" c ON c."fingerprintSetId" = s."id"
      WHERE s."organizationId" = ${organization.id} AND s."deletedAt" IS NULL
      GROUP BY s."id"
      ORDER BY s."createdAt" DESC
      LIMIT 200
    ` : [];
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown database error.";
  }

  const filtered = sets.filter((set) => {
    if (category && String(set.category).toLowerCase() !== category) return false;
    if (sensitivity && String(set.sensitivity).toLowerCase() !== sensitivity) return false;
    if (department && String(set.ownerDepartment ?? "").toLowerCase() !== department) return false;
    if (status === "enabled" && set.enabled !== true) return false;
    if (status === "disabled" && set.enabled !== false) return false;
    return true;
  });

  const departments = Array.from(new Set(sets.map((s) => String(s.ownerDepartment ?? "")).filter(Boolean))).sort();
  const exportHref = organization ? `/api/admin/fingerprint-vault/export?organizationId=${organization.id}` : "#";

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-cyan">AI data security</p>
        <h1 className="mt-2 text-3xl font-bold">Fingerprint Vault</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Register confidential reference data as SHA-256 chunks and hashed shingles. Raw document text is not stored by default.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Stat icon={<Fingerprint size={18} />} label="Fingerprint sets" value={filtered.length} />
        <Stat icon={<Database size={18} />} label="Storage mode" value="hashed_only" />
        <Stat icon={<Search size={18} />} label="Semantic matching" value="planned" />
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <Field label="Category">
          <select name="category" defaultValue={category} className={selectClass}>
            <option value="">All</option>
            {["customer_list", "financial", "source_code", "legal_contract", "hr_data", "product_roadmap", "credentials", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Sensitivity">
          <select name="sensitivity" defaultValue={sensitivity} className={selectClass}>
            <option value="">All</option>
            {["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Department">
          <select name="department" defaultValue={department} className={selectClass}>
            <option value="">All</option>
            {departments.map((d) => <option key={d} value={d.toLowerCase()}>{d}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={status} className={selectClass}>
            <option value="">All</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </Field>
        <button type="submit" className="button-primary h-9 px-4 py-0 text-sm">Apply</button>
        <a href="/admin/fingerprint-vault" className="text-xs text-slate-400 underline">Reset</a>
        <a href={exportHref} className="ml-auto text-xs text-cyan underline">Export CSV (redacted)</a>
      </form>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 p-4">
          <h2 className="font-semibold">Registered sensitive material</h2>
          <p className="text-xs text-slate-500">Filters also available via `/api/admin/fingerprint-vault?category=&department=&sensitivity=&q=`.</p>
        </div>
        {loadError ? <ErrorState text={loadError} /> : !organization ? <Empty text="Create an organization before adding fingerprints." /> : filtered.length === 0 ? <Empty text={sets.length === 0 ? "No fingerprint sets registered yet." : "No fingerprint sets match the current filters."} /> : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase text-slate-500">
              <tr><th className="p-3">Document</th><th>Category</th><th>Sensitivity</th><th>Dept</th><th>Action</th><th>Status</th><th>Hashes</th><th>Last matched</th></tr>
            </thead>
            <tbody>
              {filtered.map((set) => (
                <tr className="border-t border-slate-800" key={String(set.id)}>
                  <td className="p-3 font-medium">{String(set.name)}</td>
                  <td>{String(set.category)}</td>
                  <td>{String(set.sensitivity)}</td>
                  <td>{String(set.ownerDepartment ?? "—")}</td>
                  <td>{String(set.action)}</td>
                  <td>{set.enabled === true ? <span className="text-emerald-400">enabled</span> : <span className="text-slate-500">disabled</span>}</td>
                  <td>{String(set.fingerprintCount)}</td>
                  <td>{set.lastMatchedAt ? new Date(String(set.lastMatchedAt)).toLocaleString() : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <div className="card p-4"><div className="text-cyan">{icon}</div><p className="mt-3 text-xs text-slate-500">{label}</p><p className="text-xl font-semibold">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-slate-400">{label}{children}</label>;
}

function Empty({ text }: { text: string }) {
  return <div className="p-8 text-sm text-slate-400">{text}</div>;
}

function ErrorState({ text }: { text: string }) {
  return <div className="p-8 text-sm text-rose-400">Could not load fingerprint sets: {text}</div>;
}
