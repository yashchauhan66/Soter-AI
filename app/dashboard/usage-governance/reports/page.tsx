import { FileBarChart } from "lucide-react";
import { getActiveOrganization } from "@/lib/auth/guards";
import { listReports } from "@/lib/usage-governance";

export const dynamic = "force-dynamic";

export default async function GovernanceReportsPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const reports = await listReports(active.org.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Governance</p>
        <h1 className="mt-2 text-3xl font-bold">Compliance Reports</h1>
        <p className="mt-3 max-w-3xl text-slate-400">
          Generate and view AI usage governance compliance reports. Reports show usage trends,
          compliance scores, top providers, and recommendations.
        </p>
      </div>

      {/* Generate report */}
      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Generate New Report</h2>
          <p className="mt-1 text-sm text-slate-400">Create a governance compliance report for the selected period.</p>
        </div>
        <div className="flex gap-3">
          <form action="/api/usage-governance/reports/generate" method="POST" className="flex gap-3">
            <input type="hidden" name="organizationId" value={active.org.id} />
            <select name="period" className="input text-sm" required>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY" selected>Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
            </select>
            <button className="button-primary text-sm" type="submit">
              <FileBarChart size={16} className="mr-1" /> Generate
            </button>
          </form>
        </div>
      </div>

      {/* Reports list */}
      {reports.length === 0 ? (
        <p className="text-sm text-slate-500">No reports generated yet. Generate a report above.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div className="card p-5" key={report.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold capitalize">{report.period} Report</h3>
                  <p className="text-sm text-slate-400">
                    {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  (report.complianceScore ?? 0) >= 80 ? "bg-emerald-500/10 text-emerald-300" :
                  (report.complianceScore ?? 0) >= 50 ? "bg-amber-500/10 text-amber-300" :
                  "bg-red-500/10 text-red-300"
                }`}>
                  {(report.complianceScore ?? 0)}% Compliance
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Total Events</p>
                  <p className="text-lg font-bold">{report.totalUsageEvents}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Allowed</p>
                  <p className="text-lg font-bold text-emerald-400">{report.allowedEvents}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Blocked</p>
                  <p className="text-lg font-bold text-red-400">{report.blockedEvents}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Approvals</p>
                  <p className="text-lg font-bold text-amber-400">{report.approvalRequests}</p>
                </div>
              </div>

              {Array.isArray(report.recommendations) && (report.recommendations as string[]).length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-300">Recommendations</p>
                  <ul className="mt-2 space-y-1">
                    {(report.recommendations as string[]).map((rec, i) => (
                      <li key={i} className="text-sm text-slate-400">• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(report.findings) && (report.findings as string[]).length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-slate-300">Findings</p>
                  <ul className="mt-1 space-y-1">
                    {(report.findings as string[]).map((f, i) => (
                      <li key={i} className="text-sm text-slate-500">• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
