import { Network } from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const selectClass = "h-9 rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100 outline-none focus:border-cyan";
const dateClass = selectClass;

function pick(params: SearchParams, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
}

export default async function DataLineagePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const sourceApp = pick(params, "sourceApp").toLowerCase();
  const destination = pick(params, "destination").toLowerCase();
  const employee = pick(params, "employee").toLowerCase();
  const action = pick(params, "action").toLowerCase();
  const from = pick(params, "from");
  const to = pick(params, "to");

  let organization: { id: string } | null = null;
  let events: Array<Record<string, unknown>> = [];
  let loadError: string | null = null;
  try {
    organization = await db.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    events = organization ? await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "employeeId", "sourceApp", "sourceCategory", "destinationApp", "destinationCategory",
             "dataTypes", "riskScore", "severity", "actionTaken", "fingerprintSetId", "eventType"::text, "createdAt"
      FROM "DataLineageEvent"
      WHERE "organizationId" = ${organization.id}
      ORDER BY "createdAt" DESC
      LIMIT 500
    ` : [];
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown database error.";
  }

  const filtered = events.filter((e) => {
    if (sourceApp && String(e.sourceApp ?? "").toLowerCase() !== sourceApp) return false;
    if (destination && String(e.destinationApp ?? "").toLowerCase() !== destination) return false;
    if (employee && String(e.employeeId ?? "").toLowerCase() !== employee) return false;
    if (action && String(e.actionTaken ?? "").toLowerCase() !== action) return false;
    const ts = new Date(String(e.createdAt)).getTime();
    if (from && ts < new Date(from).getTime()) return false;
    if (to && ts > new Date(to).getTime() + 86_400_000) return false;
    return true;
  });

  const sourceApps = Array.from(new Set(events.map((e) => String(e.sourceApp ?? "")).filter(Boolean))).sort();
  const destinations = Array.from(new Set(events.map((e) => String(e.destinationApp ?? "")).filter(Boolean))).sort();
  const employees = Array.from(new Set(events.map((e) => String(e.employeeId ?? "")).filter(Boolean))).sort();
  const actions = Array.from(new Set(events.map((e) => String(e.actionTaken ?? "")).filter(Boolean))).sort();
  const exportHref = organization ? `/api/admin/data-lineage/export?organizationId=${organization.id}` : "#";

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-cyan">AI data security</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold"><Network /> Data Lineage</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Source-to-destination AI movement timeline. URLs are stored as hashes/redacted values and raw clipboard text is not stored.</p>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <Field label="Source app"><select name="sourceApp" defaultValue={sourceApp} className={selectClass}><option value="">All</option>{sourceApps.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}</select></Field>
        <Field label="Destination AI"><select name="destination" defaultValue={destination} className={selectClass}><option value="">All</option>{destinations.map((d) => <option key={d} value={d.toLowerCase()}>{d}</option>)}</select></Field>
        <Field label="Employee"><select name="employee" defaultValue={employee} className={selectClass}><option value="">All</option>{employees.map((e) => <option key={e} value={e.toLowerCase()}>{e}</option>)}</select></Field>
        <Field label="Action"><select name="action" defaultValue={action} className={selectClass}><option value="">All</option>{actions.map((a) => <option key={a} value={a.toLowerCase()}>{a}</option>)}</select></Field>
        <Field label="From"><input type="date" name="from" defaultValue={from} className={dateClass} /></Field>
        <Field label="To"><input type="date" name="to" defaultValue={to} className={dateClass} /></Field>
        <button type="submit" className="button-primary h-9 px-4 py-0 text-sm">Apply</button>
        <a href="/admin/data-lineage" className="text-xs text-slate-400 underline">Reset</a>
        <a href={exportHref} className="ml-auto text-xs text-cyan underline">Export CSV (redacted)</a>
      </form>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 p-4">
          <h2 className="font-semibold">Incident timeline</h2>
          <p className="text-xs text-slate-500">{filtered.length} of {events.length} events shown.</p>
        </div>
        {loadError ? <div className="p-8 text-sm text-rose-400">Could not load lineage events: {loadError}</div>
          : filtered.length === 0 ? <div className="p-8 text-sm text-slate-400">{events.length === 0 ? "No lineage events recorded yet." : "No events match the current filters."}</div> : (
          <ol className="divide-y divide-slate-800">
            {filtered.map((event) => (
              <li className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm" key={String(event.id)}>
                <span className="w-40 shrink-0 text-xs text-slate-500">{new Date(String(event.createdAt)).toLocaleString()}</span>
                <span className="font-medium text-cyan">{String(event.sourceApp)}</span>
                <span className="text-slate-500">→</span>
                <span className="font-medium">{String(event.destinationApp)}</span>
                <span className="text-slate-400">{Array.isArray(event.dataTypes) ? event.dataTypes.join(", ") : ""}</span>
                <span className="ml-auto text-xs">{String(event.severity)} / {String(event.riskScore)}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${badge(String(event.actionTaken))}`}>{String(event.actionTaken)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-slate-400">{label}{children}</label>;
}

function badge(action: string) {
  if (action === "block") return "bg-rose-500/15 text-rose-300";
  if (action.startsWith("require")) return "bg-amber-500/15 text-amber-300";
  if (action === "warn" || action === "redact" || action === "rewrite") return "bg-yellow-500/10 text-yellow-200";
  return "bg-slate-700/40 text-slate-300";
}
