import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { getActiveOrganization, requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const active = await getActiveOrganization();
  if (!active) {
    return <div className="card p-10 text-center text-slate-400">No organization available.</div>;
  }
  await requirePermission(active.org.id, "reports:export");
  const recent = await db.auditExport.findMany({
    where: { organizationId: active.org.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  const orgId = active.org.id;
  const downloads: Array<{ label: string; format: "JSONL" | "CSV"; kind: "GUARD_LOGS" | "WEBHOOK_DELIVERIES"; Icon: typeof FileJson }> = [
    { label: "Guard logs (JSONL, SIEM-ready)", kind: "GUARD_LOGS", format: "JSONL", Icon: FileJson },
    { label: "Guard logs (CSV)", kind: "GUARD_LOGS", format: "CSV", Icon: FileSpreadsheet },
    { label: "Webhook deliveries (JSONL)", kind: "WEBHOOK_DELIVERIES", format: "JSONL", Icon: FileJson },
    { label: "Webhook deliveries (CSV)", kind: "WEBHOOK_DELIVERIES", format: "CSV", Icon: FileSpreadsheet },
  ];

  return (
    <div>
      <p className="eyebrow">Audit</p>
      <h1 className="mt-2 text-3xl font-bold">Exports</h1>
      <p className="mt-3 text-slate-400">
        Each row carries an HMAC-SHA256 signature. The X-Manifest-Signature response header signs the row count + generation timestamp so downstream SIEMs can verify provenance.
      </p>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        {downloads.map((download) => {
          const href = `/api/exports?organizationId=${encodeURIComponent(orgId)}&kind=${download.kind}&format=${download.format}`;
          const Icon = download.Icon;
          return (
            <Link key={`${download.kind}-${download.format}`} href={href} className="card flex items-center justify-between p-5 transition hover:border-cyan/40">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-cyan/10 p-3 text-cyan"><Icon size={20} /></span>
                <div>
                  <p className="font-semibold">{download.label}</p>
                  <p className="mt-1 text-xs text-slate-500">Last 25,000 rows · redacted only · expires in 7 days</p>
                </div>
              </div>
              <Download size={18} className="text-slate-400" />
            </Link>
          );
        })}
      </div>

      <h2 className="mt-9 text-lg font-semibold">Recent exports</h2>
      {recent.length ? (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recent.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{item.kind}</td>
                  <td className="px-4 py-3">{item.format}</td>
                  <td className="px-4 py-3">{item.rowCount}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.signature?.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card mt-4 p-10 text-center text-slate-500">No exports yet.</div>
      )}
    </div>
  );
}
