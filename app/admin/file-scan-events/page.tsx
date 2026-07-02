import { FileSearch } from "lucide-react";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const selectClass = "h-9 rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm text-slate-100 outline-none focus:border-cyan";

function pick(params: SearchParams, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() || "";
}

export default async function FileScanEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ext = pick(params, "ext").toLowerCase();
  const action = pick(params, "action").toLowerCase();
  const destination = pick(params, "destination").toLowerCase();
  const dataType = pick(params, "dataType").toLowerCase();
  const severity = pick(params, "severity").toLowerCase();

  let organization: { id: string } | null = null;
  let events: Array<Record<string, unknown>> = [];
  let loadError: string | null = null;
  try {
    organization = await db.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    events = organization ? await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT "id", "employeeId", "destinationDomain", "fileNameHash", "originalExtension", "mimeType",
             "sizeBytes", "scannedBytes", "supported", "detectedDataTypes", "riskScore", "severity",
             "actionTaken", "redactedPreview", "createdAt"
      FROM "AIFileScanEvent"
      WHERE "organizationId" = ${organization.id}
      ORDER BY "createdAt" DESC
      LIMIT 500
    ` : [];
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown database error.";
  }

  const filtered = events.filter((e) => {
    if (ext && String(e.originalExtension ?? "").toLowerCase() !== ext) return false;
    if (action && String(e.actionTaken ?? "").toLowerCase() !== action) return false;
    if (destination && String(e.destinationDomain ?? "").toLowerCase() !== destination) return false;
    if (severity && String(e.severity ?? "").toLowerCase() !== severity) return false;
    if (dataType && !(Array.isArray(e.detectedDataTypes) ? e.detectedDataTypes : []).map((t) => String(t).toLowerCase()).includes(dataType)) return false;
    return true;
  });

  const exts = Array.from(new Set(events.map((e) => String(e.originalExtension ?? "")).filter(Boolean))).sort();
  const actions = Array.from(new Set(events.map((e) => String(e.actionTaken ?? "")).filter(Boolean))).sort();
  const destinations = Array.from(new Set(events.map((e) => String(e.destinationDomain ?? "")).filter(Boolean))).sort();
  const dataTypes = Array.from(new Set(events.flatMap((e) => (Array.isArray(e.detectedDataTypes) ? e.detectedDataTypes : []).map((t) => String(t))))).sort();
  const exportHref = organization ? `/api/admin/file-scan-events/export?organizationId=${organization.id}` : "#";

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-cyan">AI data security</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold"><FileSearch /> File Scan Events</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Local file-content scans before AI upload. Backend receives hashed filename, metadata, findings, and redacted preview only.</p>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <Field label="Extension"><select name="ext" defaultValue={ext} className={selectClass}><option value="">All</option>{exts.map((x) => <option key={x} value={x.toLowerCase()}>{x}</option>)}</select></Field>
        <Field label="Action"><select name="action" defaultValue={action} className={selectClass}><option value="">All</option>{actions.map((a) => <option key={a} value={a.toLowerCase()}>{a}</option>)}</select></Field>
        <Field label="Destination"><select name="destination" defaultValue={destination} className={selectClass}><option value="">All</option>{destinations.map((d) => <option key={d} value={d.toLowerCase()}>{d}</option>)}</select></Field>
        <Field label="Data type"><select name="dataType" defaultValue={dataType} className={selectClass}><option value="">All</option>{dataTypes.map((t) => <option key={t} value={t.toLowerCase()}>{t}</option>)}</select></Field>
        <Field label="Severity"><select name="severity" defaultValue={severity} className={selectClass}><option value="">All</option>{["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
        <button type="submit" className="button-primary h-9 px-4 py-0 text-sm">Apply</button>
        <a href="/admin/file-scan-events" className="text-xs text-slate-400 underline">Reset</a>
        <a href={exportHref} className="ml-auto text-xs text-cyan underline">Export CSV (redacted)</a>
      </form>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 p-4">
          <h2 className="font-semibold">Scanned file uploads</h2>
          <p className="text-xs text-slate-500">{filtered.length} of {events.length} events shown.</p>
        </div>
        {loadError ? <div className="p-8 text-sm text-rose-400">Could not load file scan events: {loadError}</div>
          : filtered.length === 0 ? <div className="p-8 text-sm text-slate-400">{events.length === 0 ? "No file scan events recorded yet." : "No events match the current filters."}</div> : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase text-slate-500"><tr><th className="p-3">Time</th><th>Destination</th><th>File</th><th>Scan</th><th>Findings</th><th>Sev</th><th>Action</th><th>Preview</th></tr></thead>
            <tbody>{filtered.map((event) => (
              <tr className="border-t border-slate-800 align-top" key={String(event.id)}>
                <td className="p-3">{new Date(String(event.createdAt)).toLocaleString()}</td>
                <td>{String(event.destinationDomain)}</td>
                <td>{String(event.originalExtension)} / {String(event.mimeType ?? "unknown")}</td>
                <td>{String(event.scannedBytes)} of {String(event.sizeBytes)} bytes</td>
                <td>{Array.isArray(event.detectedDataTypes) ? event.detectedDataTypes.join(", ") : ""}</td>
                <td>{String(event.severity)}</td>
                <td>{String(event.actionTaken)}</td>
                <td className="max-w-xs truncate text-xs text-slate-500" title={String(event.redactedPreview ?? "")}>{String(event.redactedPreview ?? "")}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-slate-400">{label}{children}</label>;
}
